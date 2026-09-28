// Prints one line per iPhone screenshot: name|language|route|state as base64 JSON.
// The iPhone app reads -state and -route at launch, so the simulator opens on the same
// prepared screens as the web screenshots.
import { state, scenes } from '../scenes.mjs';

const pick = (process.argv[2] || 'hajj-home,arafah,home,tawaf,sai,duas,look,trusts').split(',');
for (const lang of ['ar', 'en']) {
  for (const name of pick) {
    const scene = scenes.find(s => s[0] === name);
    if (!scene) throw new Error('no scene ' + name);
    const [, route, extra] = scene;
    const b64 = Buffer.from(JSON.stringify(state(lang, extra))).toString('base64');
    console.log([name, lang, route, b64].join('|'));
  }
}
