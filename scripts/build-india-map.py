"""Build compact SVG paths from the attributed geoBoundaries ADM1 GeoJSON.
Usage: python3 scripts/build-india-map.py path/to/geoBoundaries-IND-ADM1_simplified.geojson
"""
import json, math, sys, unicodedata
from pathlib import Path

def simplify(points, tolerance=0.025):
    if len(points) < 3: return points
    ax, ay = points[0][:2]; bx, by = points[-1][:2]
    dx, dy = bx-ax, by-ay
    def distance(p):
        t = max(0, min(1, ((p[0]-ax)*dx+(p[1]-ay)*dy)/(dx*dx+dy*dy))) if dx or dy else 0
        return (p[0]-ax-t*dx)**2+(p[1]-ay-t*dy)**2
    index = max(range(1,len(points)-1), key=lambda i: distance(points[i]))
    if distance(points[index]) > tolerance*tolerance:
        return simplify(points[:index+1],tolerance)[:-1]+simplify(points[index:],tolerance)
    return [points[0],points[-1]]

def project(p): return (round((p[0]-67)*17,1),round((38-p[1])*18.4,1))
features=json.loads(Path(sys.argv[1]).read_text())['features']
result=[]
for feature in features:
    name=''.join(c for c in unicodedata.normalize('NFKD',feature['properties']['shapeName']) if not unicodedata.combining(c))
    name={'Uttarakhand':'Uttarakhand','Uttarākhand':'Uttarakhand'}.get(name,name)
    geometry=feature['geometry']; polygons=geometry['coordinates'] if geometry['type']=='MultiPolygon' else [geometry['coordinates']]
    paths=[]
    allpoints=[]
    for polygon in polygons:
        for ring in polygon:
            pts=[project(p) for p in simplify(ring)]
            allpoints.extend(pts)
            paths.append('M'+'L'.join(f'{x},{y}' for x,y in pts)+'Z')
    result.append({'name':name,'path':''.join(paths)})
result.sort(key=lambda f:f['name'])
Path('apps/web/src/features/map/india-states.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print(f'Generated {len(result)} state and union territory paths')
