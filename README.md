# starpath
A blank-sky navigation game: locate hidden stars within 2 degrees using a reference constellation.

Run locally with `python -m http.server 8000 --bind 127.0.0.1`, then open http://localhost:8000.

Choose the Stars or Messier library, then search by name or catalog designation. Examples: `Betelgeuse`, `alpha orion`, `α Ori`, `40 Eridani`, `HIP 19849`, `M31`, `Messier 31`, or `Orion Nebula`. Search filters the picker as you type; use the arrows to browse 30 entries at a time. Searching an exact object from the other library switches the picker automatically. Each library remembers your last target.

Selecting a target or library keeps the reference chart, zoom, score, and found objects. Pan or zoom to explore, or explicitly choose a different reference chart; progress and each chart's view are retained. Changing difficulty or choosing Explore again starts a new expedition. Both stars and Messier objects use a 2° placement tolerance; place the catalog center of a Messier object.

Charts use a consistent stereographic angular scale. The 10° ruler gives the local scale; star markers and labels retain their screen size when zooming. Explorer guide lines connect reference stars and stars you have found, with an equatorial grid every 15°. Hidden targets are never drawn. Expert mode disables guides and hints.

The bundled `bright-stars.js` contains all **1,637 non-Solar entries with apparent visual magnitude ≤ 5.00** from [HYG v4.0](https://github.com/astronexus/HYG-Database/blob/main/hyg/CURRENT/hygdata_v40.csv.gz), including separate binary components. Positions use J2000 coordinates; variable-star magnitudes are catalog values. Stars can be searched by common names, Bayer and Flamsteed designations (constellation abbreviations, nominative and genitive names), and HIP/HD/HR identifiers. Duplicate names receive a HYG ID suffix. The catalog is adapted from HYG under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); see `HYG-LICENSE.txt`.

`messier-objects.js` contains **M1–M110**, regardless of magnitude, and shows found objects as small diamonds. Coordinates and metadata for 109 entries come from the [NASA HEASARC Messier catalog](https://heasarc.gsfc.nasa.gov/W3Browse/general-catalog/messier.html), which omits the historically disputed M102. We include M102 as NGC 5866 (Spindle Galaxy), using J2000 coordinates from [OpenNGC](https://github.com/mattiaverga/OpenNGC) by Mattia Verga under CC BY-SA 4.0; see `OPENNGC-LICENSE.txt`. This identification is also used in [NASA's Hubble Messier catalog](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-102/).

To rebuild the bundled data, download the [HYG CSV](https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v40.csv.gz), [HEASARC table](https://heasarc.gsfc.nasa.gov/FTP/heasarc/dbase/tdat_files/heasarc_messier.tdat.gz), and [OpenNGC CSV](https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv), then run `python tools/build_catalogs.py /path/to/hyg.csv.gz /path/to/messier.tdat.gz /path/to/NGC.csv`. The script filters HYG by the inclusive magnitude cutoff, converts HEASARC right ascension from degrees to hours, and checks the complete Messier sequence and unique catalog names.

Open http://localhost:8000/tests/catalog.html to run browser checks for search aliases, catalog coverage, hidden targets, every star's projection, all 110 Messier placements, scoring, stable views, library selection, pagination, live filtering, and the original gameplay.
