"""Build constellation-data.js from Bill Gray's constbnd.dat (CDS VI/49).

Usage: python tools/build_constellations.py /path/to/constbnd.dat
All positions in the source are B1875. The matrix maps them to J2000.
"""
import argparse
import json
import math
from collections import defaultdict
from pathlib import Path
from build_catalogs import CONSTELLATIONS


def vector(ra, dec):
    a, d = math.radians(ra * 15), math.radians(dec)
    return [math.cos(d) * math.cos(a), math.cos(d) * math.sin(a), math.sin(d)]


def position(v):
    return [math.degrees(math.atan2(v[1], v[0])) / 15 % 24,
            math.degrees(math.atan2(v[2], math.hypot(v[0], v[1])))]


def precession_matrix():
    # IAU 1976 precession, from the B1875 equinox to J2000.
    jd = 2415020.31352 + (1875 - 1900) * 365.242198781
    T = (jd - 2451545) / 36525
    t = -T
    base = 2306.2181 + 1.39656 * T - .000139 * T * T
    zeta = base * t + (.30188 - .000344 * T) * t*t + .017998 * t*t*t
    z = base * t + (1.09468 + .000066 * T) * t*t + .018203 * t*t*t
    theta = (2004.3109 - .85330 * T - .000217 * T*T) * t - (.42665 + .000217 * T) * t*t - .041833 * t*t*t
    zeta, z, theta = [math.radians(angle / 3600) for angle in (zeta, z, theta)]
    cz, sz, ct, st, cq, sq = math.cos(z), math.sin(z), math.cos(theta), math.sin(theta), math.cos(zeta), math.sin(zeta)
    return [[cz*ct*cq-sz*sq, -cz*ct*sq-sz*cq, -cz*st],
            [sz*ct*cq+cz*sq, -sz*ct*sq+cz*cq, -sz*st],
            [st*cq, -st*sq, ct]]


def contains(ring, ra, dec):
    points = list(ring)
    if abs(points[-1][0] - points[0][0]) > 12:
        pole = 90 if sum(p[1] for p in points) > 0 else -90
        points.extend([[points[-1][0], pole], [points[0][0], pole], points[0]])
    low, high = min(p[0] for p in points), max(p[0] for p in points)
    result = False
    for cycle in range(math.floor((low-ra)/24), math.ceil((high-ra)/24)+1):
        x = ra + cycle * 24
        if x < low or x > high:
            continue
        inside = False
        for a, b in zip(points, points[1:]):
            if (a[1] > dec) != (b[1] > dec) and x < a[0] + (b[0]-a[0]) * (dec-a[1]) / (b[1]-a[1]):
                inside = not inside
        # Polar rings can overlap shifted copies across the artificial seam.
        # Parity removes those seam overlaps without cutting the spherical region.
        if inside:
            result = not result
    return result


def build(source):
    names = {code: name for code, name, _ in (line.split('|') for line in CONSTELLATIONS.splitlines() if line)}
    names['Boo'] = 'Boötes'
    canonical = {code.lower(): code for code in names}
    rings, neighbors, edges = defaultdict(list), defaultdict(set), defaultdict(list)
    current = None
    for line in source.read_text(encoding='utf-8').splitlines():
        fields = line.split()
        ra, dec, raw = float(fields[0]), float(fields[1]), fields[2]
        code = canonical[raw[:3].lower()]
        assert code in names, raw
        if len(fields) == 3:
            current = []
            rings[code].append(current)
        if current:
            ra += round((current[-1][0] - ra) / 24) * 24
        point = [ra, dec]
        if len(fields) == 4:
            other = canonical[fields[3][:3].lower()]
            neighbors[code].add(other)
            edges[code].append((current[-1], point, other))
        current.append(point)
    assert len(rings) == 88 and sum(map(len, rings.values())) == 89
    for code, others in neighbors.items():
        assert code not in others and all(code in neighbors[other] for other in others), code
    matrix = precession_matrix()
    def to_j2000(point):
        v = vector(*point)
        return position([sum(row[i] * v[i] for i in range(3)) for row in matrix])
    def owner(ra, dec):
        found = [code for code, paths in rings.items() if any(contains(path, ra % 24, dec) for path in paths)]
        assert len(found) == 1, (ra, dec, found)
        return found[0]
    output = []
    for code in sorted(names):
        samples = []
        anchors = defaultdict(list)
        for a, b, other in edges[code]:
            dra, ddec = b[0]-a[0], b[1]-a[1]
            length = math.hypot(dra*15*math.cos(math.radians((a[1]+b[1])/2)), ddec)
            assert length > 0, (code, a, b)
            steps = max(1, math.ceil(length))
            samples.extend(to_j2000([a[0]+dra*i/steps, a[1]+ddec*i/steps]) for i in range(steps))
            mid = [(a[0]+b[0])/2, (a[1]+b[1])/2]
            dx, dy = dra*15*math.cos(math.radians(mid[1])), ddec
            for offset in [1, .4, .1, .02]:
                candidate = [mid[0]-dy/length*offset/(15*math.cos(math.radians(mid[1]))), mid[1]+dx/length*offset]
                if -90 < candidate[1] < 90 and owner(*candidate) == other:
                    anchors[other].append(to_j2000(candidate))
                    break
        assert all(anchors[other] for other in neighbors[code]), (code, 'missing neighbor anchor')
        mean = [sum(vector(*point)[i] for point in samples) for i in range(3)]
        center = position(mean)
        cv = vector(*center)
        nearest = lambda points: max(points, key=lambda point: sum(a*b for a,b in zip(vector(*point), cv)))
        # An interior label point, independent of the mean (concave / split regions).
        interior = []
        for a, b, _ in edges[code]:
            mid = [(a[0]+b[0])/2, (a[1]+b[1])/2]
            dx, dy = (b[0]-a[0])*15*math.cos(math.radians(mid[1])), b[1]-a[1]
            length = math.hypot(dx,dy)
            for offset in [2, 1, .2]:
                point = [mid[0]+dy/length*offset/(15*math.cos(math.radians(mid[1]))), mid[1]-dx/length*offset]
                if -90 < point[1] < 90 and owner(*point) == code:
                    interior.append(to_j2000(point))
        assert interior, code
        output.append({'id':code, 'name':names[code], 'neighbors':sorted(neighbors[code]),
                       'rings':rings[code], 'center':center, 'label':nearest(interior),
                       'anchors':{other:nearest(anchors[other]) for other in sorted(neighbors[code])}})
    # Exhaustive sky grid checks expose RA wrap and polar polygon gaps/overlap.
    for ra in [i*.25+.123 for i in range(96)]:
        for dec in [i+.321 for i in range(-90,90)]:
            owner(ra, dec)
    atlas = {'epoch':'B1875', 'toJ2000':matrix, 'constellations':output}
    target = Path(__file__).resolve().parents[1] / 'constellation-data.js'
    target.write_text('// IAU boundaries: CDS VI/49, Davenhall & Leggett; adjacency by Bill Gray. See CONSTELLATION-SOURCES.md.\nconst constellationAtlas='+json.dumps(atlas, ensure_ascii=False, separators=(',',':'))+';\n', encoding='utf-8')
    print(f'Built {len(output)} constellations, 89 polygons, symmetric adjacency; verified 17,280 sky positions.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('boundaries', type=Path)
    build(parser.parse_args().boundaries)
