# Constellation game data

The numeric boundary coordinates are based on Eugène Delporte's IAU constellation regions, published in *Délimitation scientifique des constellations* (1930).

The game uses the B1875 vertices and explicit adjacent-region identifiers in `constbnd.dat` by **Bill J. Gray**, distributed with **CDS VI/49, Constellation Boundary Data (A. C. Davenhall and S. K. Leggett, 1989)**. Downloaded from the [author's repository](https://github.com/Bill-Gray/constbnd/blob/master/constbnd.dat), which supplies more decimal places than the CDS copy. See the [author's format documentation](https://github.com/Bill-Gray/constbnd/blob/master/constbnd.txt) and [CDS catalogue description](https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/VI/49?format=html&tex=true). Bibliographic identifier: `1997yCat.6049....0D`. This work makes use of the VizieR catalogue service, CDS, Strasbourg ([DOI: 10.26093/cds/vizier](https://doi.org/10.26093/cds/vizier)).

`constellation-data.js` bundles the original numeric vertices, a symmetric neighbor graph, interior neighbor placement samples, display centers, and an IAU 1976 precession matrix from B1875 to J2000. Browser hit-testing converts a click back to B1875 and tests the original regions. Rendering samples each boundary's parallels/meridians at intervals of at most 0.5° before precession and projection. Unknown neighbors are not drawn. The geometry handles the 0/24-hour wrap, the celestial poles, and the two disconnected regions of Serpens. Neighbors share an actual edge, rather than just a corner. The boundary set is unchanged by the star magnitude limit.

To rebuild:

```sh
python tools/build_constellations.py /path/to/constbnd.dat
```

The builder checks 88 constellations / 89 regions, symmetric adjacency, a valid point inside each neighbor for every constellation, and unique coverage at 17,280 positions across the sky. Runtime browser checks include poles, RA wrap, star membership, projection round trips, valid/invalid placements, scores, successive rounds, and mobile controls.

Stars use the existing `bright-stars.js`: HYG v4.0 under **CC BY-SA 4.0**, with attribution and license in [HYG-LICENSE.txt](HYG-LICENSE.txt). J2000 coordinates are assigned to constellations using the boundary geometry, rather than relying on their catalog labels. All catalog entries at or brighter than the inclusive selected magnitude appear in the starting constellation and in each neighbor you successfully discover. In Conquer mode, every claimed region keeps its stars available, and the map can be centered on any claim. Unclaimed constellation stars remain hidden. Separate binary components remain separate entries, as in the original game.

Both controls default to **4.00**, defined by `DEFAULT_MAGNITUDE_LIMIT` (display) and `DEFAULT_STARTING_MAGNITUDE` (starting selection) in `constellation-game.js`. The display control supports 0.00–5.00 using the bundled magnitude-5 star catalog; starting selection supports −2.00–5.00 and uses the smallest catalog magnitude in each region. Both conditions must hold for a starting pattern. To raise the catalog maximum, expand the star data and update the UI/range validation. Constellations without qualifying stars are omitted from identification rounds; all regions remain available for neighboring discoveries and Conquer claims.
