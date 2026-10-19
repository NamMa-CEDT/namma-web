"""Province and tambon outlines for the flood map → public/boundaries (see src/lib/boundaries.ts).

    pip install pyshp shapely
    python scripts/build_boundaries.py <folder with the unzipped HDX shapefiles> [out folder]

Source: Thailand subnational administrative boundaries, Royal Thai Survey Department, via OCHA HDX
(https://data.humdata.org/dataset/cod-ab-tha, tha_admin_boundaries.shp.zip), CC BY-IGO 3.0: credit it in the UI.

Writes provinces.json (simplified to ~500 m) and tambons/<province code>.json (~80 m), GeoJSON with properties
{code, province, amphoe, tambon, area_km2, label: [lat, lon], bbox (provinces)}. code is the P-code without "TH"
(province "14", tambon "140504"), the same numbers GISTDA reports as pv_idn / tb_idn. area_km2 is the whole area
before simplifying, which is what a flooded share is taken of.
"""
import json
import math
import re
import sys
from collections import defaultdict
from pathlib import Path

import shapefile
from shapely.geometry import mapping, shape
from shapely.ops import transform
from shapely.validation import make_valid

THAI = re.compile(r"[฀-๿]")
TOLERANCE = {1: 0.005, 3: 0.0008}   # degrees: ~500 m for provinces, ~80 m for tambons
DIGITS = {1: 3, 3: 4}               # ~100 m / ~10 m


def find_shp(folder: Path, level: int) -> Path:
    hits = [p for p in folder.rglob("*.shp") if re.search(rf"adm(in)?{level}(?!\d)", p.stem.lower())]
    if not hits:
        sys.exit(f"no admin level {level} shapefile under {folder}")
    return min(hits, key=lambda p: len(p.stem))


def records(path: Path):
    r = shapefile.Reader(str(path), encoding="utf-8")
    names = [f[0].lower() for f in r.fields[1:]]
    for sr in r.iterShapeRecords():
        yield dict(zip(names, sr.record)), sr.shape.__geo_interface__


def thai_name(rec: dict, level: int) -> str | None:
    """The level's Thai name, from whichever adm<level>_* field holds Thai text (the field names vary by release)."""
    for k, v in rec.items():
        if k.startswith(f"adm{level}_") and "pcode" not in k and isinstance(v, str) and THAI.search(v):
            return v.strip()
    return None


def area_km2(geom) -> float:
    """Area on a local equirectangular projection: good to well under 1% at Thailand's size of area."""
    lat0 = geom.centroid.y
    kx, ky = 111.320 * math.cos(math.radians(lat0)), 110.574
    return transform(lambda x, y, z=None: (x * kx, y * ky), geom).area


def rounded(obj, digits: int):
    if isinstance(obj, float):
        return round(obj, digits)
    if isinstance(obj, (list, tuple)):
        return [rounded(x, digits) for x in obj]
    return obj


def feature(rec: dict, geo: dict, level: int) -> dict | None:
    geom = make_valid(shape(geo))
    if geom.is_empty:
        return None
    simple = geom.simplify(TOLERANCE[level], preserve_topology=True)
    if simple.geom_type not in ("Polygon", "MultiPolygon"):   # make_valid may return a collection
        polys = [g for g in getattr(simple, "geoms", []) if g.geom_type in ("Polygon", "MultiPolygon")]
        if not polys:
            return None
        from shapely.ops import unary_union
        simple = unary_union(polys)
    pt = geom.representative_point()
    code = str(rec[f"adm{level}_pcode"]).removeprefix("TH")
    props = {"code": code, "province": thai_name(rec, 1), "amphoe": thai_name(rec, 2) if level == 3 else None,
             "tambon": thai_name(rec, 3) if level == 3 else None,
             "area_km2": round(float(rec.get("area_sqkm") or area_km2(geom)), 3),   # RTSD's own figure when given
             "label": [round(pt.y, 4), round(pt.x, 4)]}
    if level == 1:
        props["bbox"] = [round(v, 3) for v in geom.bounds]
    g = mapping(simple)
    return {"type": "Feature", "properties": props,
            "geometry": {"type": g["type"], "coordinates": rounded(g["coordinates"], DIGITS[level])}}


def write(path: Path, feats: list[dict]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":"))
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


def main() -> None:
    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "public" / "boundaries"

    provinces = [f for rec, geo in records(find_shp(src, 1)) if (f := feature(rec, geo, 1))]
    provinces.sort(key=lambda f: f["properties"]["code"])
    size = write(out / "provinces.json", provinces)
    print(f"provinces.json: {len(provinces)} provinces, {size / 1024:.0f} KB")

    by_province: dict[str, list[dict]] = defaultdict(list)
    for rec, geo in records(find_shp(src, 3)):
        if f := feature(rec, geo, 3):
            by_province[f["properties"]["code"][:2]].append(f)
    total, biggest = 0, (0, "")
    for pv, feats in sorted(by_province.items()):
        feats.sort(key=lambda f: f["properties"]["code"])
        size = write(out / "tambons" / f"{pv}.json", feats)
        total += size
        biggest = max(biggest, (size, pv))
    print(f"tambons/: {sum(map(len, by_province.values()))} tambons in {len(by_province)} files, "
          f"{total / 1024 / 1024:.1f} MB, largest {biggest[1]}.json {biggest[0] / 1024:.0f} KB")
    missing = [f["properties"]["code"] for fs in by_province.values() for f in fs if not f["properties"]["tambon"]]
    if missing:
        print(f"warning: {len(missing)} tambons without a Thai name, e.g. {missing[:5]}")


if __name__ == "__main__":
    main()
