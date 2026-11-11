// Regression coverage for loading order, autoplay policy and failed images.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

class Element {
  listeners = {};
  dataset = {};
  classes = new Set();
  classList = {add:name=>this.classes.add(name), remove:name=>this.classes.delete(name)};
  children = {};
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  emit(name) { for (const callback of this.listeners[name] || []) callback({preventDefault(){}}); }
  querySelector(name) { return this.children[name]; }
  setAttribute(name,value) { this[name]=value; }
  getAttribute(name) { return this[name] || null; }
  removeAttribute(name) { delete this[name]; }
  append(child) { this.appended = child; }
  remove() { this.removed = true; }
}
function fixture({mobile=true, saveData=false, reduced=false} = {}) {
  const videos = Array.from({length:2}, () => {
    const container = new Element();
    for (const selector of ['.video-button','.video-label','.video-status','.video-controls']) container.children[selector] = new Element();
    const video = new Element();
    Object.assign(video, {dataset:{src:'desktop.mp4',mobileSrc:'mobile.mp4',poster:'poster.webp'}, paused:true, loads:0, plays:0,
      closest:()=>container, load(){this.loads++; this.error=null;},
      play(){this.plays++; this.paused=false; this.emit('playing'); return Promise.resolve();},
      pause(){if (!this.paused) {this.paused=true; this.emit('pause');}}, container});
    return video;
  });
  const figure = new Element();
  const source = new Element();
  const img = new Element();
  Object.assign(img, {dataset:{fallback:'desktop.webp',mobileFallback:'mobile.webp'},
    closest:selector=>selector==='picture'?{querySelectorAll:()=>[source]}:figure});
  const doc = new Element();
  doc.querySelector = () => null;
  doc.querySelectorAll = selector => selector.startsWith('img') ? [img] : videos;
  doc.createElement = () => new Element();
  const observers = [];
  const motion = Object.assign(new Element(),{matches:reduced});
  const context = {document:doc,navigator:{connection:{saveData}},
    matchMedia:query=>query.includes('reduced-motion')?motion:Object.assign(new Element(),{matches:mobile}),
    IntersectionObserver:class {constructor(callback,options){Object.assign(this,{callback,options});observers.push(this);} observe(){}},
    window:{IntersectionObserver:true}, Date};
  vm.runInNewContext(readFileSync(new URL('../site.js',import.meta.url),'utf8'), context);
  const enter = (index,visible) => observers[1].callback([{target:videos[index],isIntersecting:visible,intersectionRatio:visible?1:0}]);
  return {videos,doc,motion,observers,enter,img,figure,source};
}
const normal = fixture();
assert.ok(normal.videos.every(v=>!v.src));
normal.observers[0].callback([{target:normal.videos[0],isIntersecting:true}]);
assert.equal(normal.videos[0].src,'mobile.mp4');
assert.equal(normal.videos[0].plays,0);
assert.equal(normal.videos[1].src,undefined);
normal.enter(0,true);
assert.equal(normal.videos[0].paused,false);
assert.equal(normal.videos[0].controls,false,'mobile autoplay must not show native controls');
normal.videos[0].container.children['.video-controls'].emit('click');
assert.equal(normal.videos[0].controls,true,'native controls remain available on request');
normal.enter(0,false);
assert.equal(normal.videos[0].controls,false,'hide the overlay when scrolling away');
assert.equal(normal.videos[0].paused,true);
normal.enter(0,true);
assert.equal(normal.videos[0].paused,false,'automatic pause must allow resuming');
normal.videos[0].pause();
normal.enter(0,false);normal.enter(0,true);
assert.equal(normal.videos[0].paused,true,'respect a manual pause');
for (const options of [{saveData:true},{reduced:true}]) {
  const f=fixture(options);f.observers[0].callback([{target:f.videos[0],isIntersecting:true}]);f.enter(0,true);
  assert.equal(f.videos[0].src,undefined);
  assert.equal(f.videos[0].poster,'poster.webp');
  f.videos[0].container.children['.video-button'].emit('click');
  assert.equal(f.videos[0].paused,false,'manual play remains available');
}
const desktop=fixture({mobile:false});desktop.enter(0,true);
assert.equal(desktop.videos[0].src,'desktop.mp4');
assert.equal(desktop.videos[0].controls,true,'desktop keeps native controls');
desktop.doc.hidden=true;desktop.doc.emit('visibilitychange');
assert.equal(desktop.videos[0].paused,true);
desktop.doc.hidden=false;desktop.doc.emit('visibilitychange');
assert.equal(desktop.videos[0].paused,false);
normal.img.emit('error');
assert.equal(normal.img.src,'mobile.webp');assert.equal(normal.source.removed,true);
normal.img.emit('error');
assert.ok(normal.figure.appended,'offer manual retry after one fallback');
normal.figure.appended.emit('click');
assert.match(normal.img.src,/^mobile.webp\?retry=/);
normal.img.emit('load');assert.equal(normal.figure.appended.removed,true);
console.log('Media tests passed: mobile/desktop, nearby loading, pause/resume, reduced motion, data saving, image fallback and retry.');
