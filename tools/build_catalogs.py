"""Build bundled catalogs: python tools/build_catalogs.py HYG.csv.gz messier.tdat.gz NGC.csv.

Sources: HYG v4.0 (CC BY-SA 4.0), NASA HEASARC Messier table,
and OpenNGC NGC5866 (Mattia Verga, CC BY-SA 4.0).
"""
import argparse
import csv
import gzip
import json
from collections import Counter
from pathlib import Path

CONSTELLATIONS = '''And|Andromeda|Andromedae
Ant|Antlia|Antliae
Aps|Apus|Apodis
Aqr|Aquarius|Aquarii
Aql|Aquila|Aquilae
Ara|Ara|Arae
Ari|Aries|Arietis
Aur|Auriga|Aurigae
Boo|Bootes|Bootis
Cae|Caelum|Caeli
Cam|Camelopardalis|Camelopardalis
Cnc|Cancer|Cancri
CVn|Canes Venatici|Canum Venaticorum
CMa|Canis Major|Canis Majoris
CMi|Canis Minor|Canis Minoris
Cap|Capricornus|Capricorni
Car|Carina|Carinae
Cas|Cassiopeia|Cassiopeiae
Cen|Centaurus|Centauri
Cep|Cepheus|Cephei
Cet|Cetus|Ceti
Cha|Chamaeleon|Chamaeleontis
Cir|Circinus|Circini
Col|Columba|Columbae
Com|Coma Berenices|Comae Berenices
CrA|Corona Australis|Coronae Australis
CrB|Corona Borealis|Coronae Borealis
Crv|Corvus|Corvi
Crt|Crater|Crateris
Cru|Crux|Crucis
Cyg|Cygnus|Cygni
Del|Delphinus|Delphini
Dor|Dorado|Doradus
Dra|Draco|Draconis
Equ|Equuleus|Equulei
Eri|Eridanus|Eridani
For|Fornax|Fornacis
Gem|Gemini|Geminorum
Gru|Grus|Gruis
Her|Hercules|Herculis
Hor|Horologium|Horologii
Hya|Hydra|Hydrae
Hyi|Hydrus|Hydri
Ind|Indus|Indi
Lac|Lacerta|Lacertae
Leo|Leo|Leonis
LMi|Leo Minor|Leonis Minoris
Lep|Lepus|Leporis
Lib|Libra|Librae
Lup|Lupus|Lupi
Lyn|Lynx|Lyncis
Lyr|Lyra|Lyrae
Men|Mensa|Mensae
Mic|Microscopium|Microscopii
Mon|Monoceros|Monocerotis
Mus|Musca|Muscae
Nor|Norma|Normae
Oct|Octans|Octantis
Oph|Ophiuchus|Ophiuchi
Ori|Orion|Orionis
Pav|Pavo|Pavonis
Peg|Pegasus|Pegasi
Per|Perseus|Persei
Phe|Phoenix|Phoenicis
Pic|Pictor|Pictoris
Psc|Pisces|Piscium
PsA|Piscis Austrinus|Piscis Austrini
Pup|Puppis|Puppis
Pyx|Pyxis|Pyxidis
Ret|Reticulum|Reticuli
Sge|Sagitta|Sagittae
Sgr|Sagittarius|Sagittarii
Sco|Scorpius|Scorpii
Scl|Sculptor|Sculptoris
Sct|Scutum|Scuti
Ser|Serpens|Serpentis
Sex|Sextans|Sextantis
Tau|Taurus|Tauri
Tel|Telescopium|Telescopii
Tri|Triangulum|Trianguli
TrA|Triangulum Australe|Trianguli Australis
Tuc|Tucana|Tucanae
UMa|Ursa Major|Ursae Majoris
UMi|Ursa Minor|Ursae Minoris
Vel|Vela|Velorum
Vir|Virgo|Virginis
Vol|Volans|Volantis
Vul|Vulpecula|Vulpeculae'''
constellations = {parts[0]: parts[1:] for parts in (line.split('|') for line in CONSTELLATIONS.splitlines())}
greek = dict(zip('Alp Bet Gam Del Eps Zet Eta The Iot Kap Lam Mu Nu Xi Omi Pi Rho Sig Tau Ups Phi Chi Psi Ome'.split(), 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega'.split()))
common_names = {1:['Crab Nebula'],6:['Butterfly Cluster'],7:['Ptolemy Cluster'],8:['Lagoon Nebula'],11:['Wild Duck Cluster'],13:['Hercules Cluster','Great Globular Cluster in Hercules'],16:['Eagle Nebula'],17:['Omega Nebula','Swan Nebula'],20:['Trifid Nebula'],24:['Sagittarius Star Cloud'],27:['Dumbbell Nebula'],31:['Andromeda Galaxy'],33:['Triangulum Galaxy'],40:['Winnecke 4'],42:['Orion Nebula','Great Orion Nebula'],43:["De Mairan's Nebula"],44:['Beehive Cluster','Praesepe'],45:['Pleiades','Seven Sisters'],51:['Whirlpool Galaxy'],57:['Ring Nebula'],63:['Sunflower Galaxy'],64:['Black Eye Galaxy'],76:['Little Dumbbell Nebula'],81:["Bode's Galaxy"],82:['Cigar Galaxy'],83:['Southern Pinwheel Galaxy'],97:['Owl Nebula'],101:['Pinwheel Galaxy'],102:['Spindle Galaxy'],104:['Sombrero Galaxy']}

def build_stars(path):
    with gzip.open(path,'rt',encoding='utf-8') as f:
        rows=[r for r in csv.DictReader(f) if r['id']!='0' and float(r['mag'])<=5.00]
    objects=[]
    for r in rows:
        nom,gen=constellations[r['con']]
        parts=r['bayer'].split('-');letter=greek.get(parts[0],'');number=parts[1] if len(parts)>1 else ''
        designation=(letter+number+' '+gen) if letter else ((r['flam']+' '+gen) if r['flam'] else 'HIP '+r['hip'] if r['hip'] else 'HYG '+r['id'])
        name=r['proper'] or ('Regor' if r['id']=='39840' else 'Capella component' if r['id']=='118360' else designation)
        aliases=[designation]
        if letter:
            for suffix in [r['con'],nom,gen]: aliases.extend([letter+number+' '+suffix,parts[0]+number+' '+suffix])
            if number=='1': aliases.extend([letter+' '+suffix for suffix in [r['con'],nom,gen]])
        if r['flam']: aliases.extend(r['flam']+' '+suffix for suffix in [r['con'],nom,gen])
        for key in ['hip','hd','hr']:
            if r[key]: aliases.append(key.upper()+' '+r[key])
        if name=='Betelgeuse': aliases.append('Betelguese')
        if name=='Rigil Kentaurus': aliases.extend(['Alpha Centauri','Alpha Centaurus'])
        if name=='Regor': aliases.extend(['gamma Velorum','gamma Vela','gamma Vel'])
        if name=='Aljanah': aliases.append('Gienah Cygni')
        ci=float(r['ci'] or 0)
        objects.append(dict(name=name,ra=float(r['ra']),dec=float(r['dec']),mag=float(r['mag']),color='orange' if ci>1.1 else 'gold' if ci>.6 else 'white' if ci>0 else 'blue',designation=designation,aliases=list(dict.fromkeys(aliases)),hygId=int(r['id']),kind='star',constellation=nom))
    counts=Counter(o['name'] for o in objects)
    for o in objects:
        if counts[o['name']]>1:
            o['aliases'].append(o['name']);o['name']+=' (HYG '+str(o['hygId'])+')'
    return sorted(objects,key=lambda o:(o['mag'],o['name']))

def build_messier(path,ngc_path):
    text=gzip.open(path,'rt',encoding='utf-8').read()
    fields=text.split('line[1] = ')[1].splitlines()[0].split()
    rows=[dict(zip(fields,line.split('|'))) for line in text.split('<DATA>')[1].split('</DATA>')[0].splitlines() if '|' in line]
    types={'OC':'Open cluster','GB':'Globular cluster','DI':'Diffuse nebula','PL':'Planetary nebula','E':'Elliptical galaxy','IR':'Irregular galaxy','S':'Spiral galaxy'}
    objects=[]
    for r in rows:
        n=int(r['name'].replace('M','').strip());names=common_names.get(n,[])
        objects.append(dict(name='M'+str(n),number=n,ra=float(r['ra'])/15,dec=float(r['dec']),mag=float(r['vmag']) if r['vmag'] else None,kind='messier',color='white',designation=r['alt_name'].strip(),commonName=names[0] if names else '',objectType={1:'Supernova remnant',16:'Cluster and nebula',24:'Star cloud',40:'Double star',73:'Asterism'}.get(n,types.get(r['object_type'].upper(),'Deep-sky object')),aliases=['Messier '+str(n),'M '+str(n),'M'+str(n).zfill(3),*names,*([r['alt_name'].strip()] if r['alt_name'].strip() else [])]))
    with open(ngc_path,encoding='utf-8') as f: r=next(row for row in csv.DictReader(f,delimiter=';') if row['Name']=='NGC5866')
    def sexagesimal(value):
        sign=-1 if value.startswith('-') else 1
        h,m,s=map(float,value.lstrip('+-').split(':'));return sign*(h+m/60+s/3600)
    objects.append(dict(name='M102',number=102,ra=sexagesimal(r['RA']),dec=sexagesimal(r['Dec']),mag=float(r['V-Mag']),kind='messier',color='white',designation='NGC 5866',commonName='Spindle Galaxy',objectType='Lenticular galaxy',aliases=['Messier 102','M 102','NGC 5866','Spindle Galaxy']))
    objects.sort(key=lambda o:o['number'])
    assert [o['number'] for o in objects]==list(range(1,111))
    return objects

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('hyg');parser.add_argument('messier');parser.add_argument('ngc');args=parser.parse_args()
    root=Path(__file__).resolve().parents[1]
    for filename,variable,objects,header in [
        ('bright-stars.js','brightStars',build_stars(args.hyg),'HYG v4.0, https://github.com/astronexus/HYG-Database; CC BY-SA 4.0 (HYG-LICENSE.txt). All non-Solar entries with V magnitude <= 5.00.'),
        ('messier-objects.js','messierObjects',build_messier(args.messier,args.ngc),'NASA HEASARC Messier table, https://heasarc.gsfc.nasa.gov/W3Browse/general-catalog/messier.html. M102/NGC5866: OpenNGC by Mattia Verga, CC BY-SA 4.0 (OPENNGC-LICENSE.txt).')]:
        assert len({o['name'] for o in objects})==len(objects)
        (root/filename).write_text('// '+header+'\n// J2000: RA in hours, declination in degrees. Derived for Starpath.\nconst '+variable+' = '+json.dumps(objects,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
        print(filename,len(objects))
