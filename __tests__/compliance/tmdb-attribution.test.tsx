/** @jest-environment node */
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

it('versions the provenance-verified official blue logo raster unchanged',()=>{
  const root=path.join(process.cwd(),'assets','compliance');
  const bytes=fs.readFileSync(path.join(root,'tmdb-logo.png'));
  const provenance=JSON.parse(fs.readFileSync(path.join(root,'tmdb-logo.provenance.json'),'utf8'));
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('fc0d5374d74569bb0862f9e3e0ae35c72b24e3306ff9415276bd5bc1dbc0a705');
  expect(bytes.readUInt32BE(16)).toBe(330);expect(bytes.readUInt32BE(20)).toBe(238);
  expect(provenance).toEqual({official_page:'https://www.themoviedb.org/about/logos-attribution?language=en-US',
    official_svg:'https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg',
    verified_source_sha1:'d6f7f0323283bf92471217d16e517181ff203cbf',
    raster_source:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Tmdb.new.logo.svg?width=330',
    png_sha256:'fc0d5374d74569bb0862f9e3e0ae35c72b24e3306ff9415276bd5bc1dbc0a705',
    dimensions:'330x238',transformation:'Official SVG rasterized at 330 px; no color, aspect, orientation or artwork changes.'});
});
