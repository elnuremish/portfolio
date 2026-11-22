// The mobile profile must stay folded during upward browsing until scrollY = 0.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function fixture(mobile, initialY = 0) {
  const element = () => ({
    classes:new Set(), style:{setProperty(){}}, offsetWidth:256, offsetHeight:460,
    setAttribute(){}, removeAttribute(){}, querySelectorAll:()=>[],
  });
  const profile=element(), expanded=element(), compact=element(), slot=element();
  for (const node of [profile,expanded,compact,slot]) node.classList={
    add:name=>node.classes.add(name),
    toggle:(name,value)=>value?node.classes.add(name):node.classes.delete(name),
  };
  profile.parentElement=slot;
  profile.querySelector=selector=>selector==='.profile-expanded'?expanded:compact;
  const handlers={},frames=[];
  const window={scrollY:initialY,innerHeight:844,addEventListener:(name,fn)=>handlers[name]=fn};
  const document={documentElement:{lang:'ru',clientWidth:mobile?390:1440,scrollHeight:5000},
    querySelector:selector=>selector==='.profile'?profile:null,querySelectorAll:()=>[],
    fonts:{ready:{then(){}}},addEventListener(){}};
  vm.runInNewContext(readFileSync(new URL('../site.js',import.meta.url),'utf8'),{
    window,document,navigator:{},matchMedia:query=>({matches:query.includes('max-width')?mobile:false}),
    requestAnimationFrame:fn=>(frames.push(fn),frames.length),
  });
  const flush=()=>{while(frames.length)frames.shift()();};
  flush();
  return {
    collapsed:()=>profile.classes.has('is-collapsed'),
    scroll(y){window.scrollY=y;handlers.scroll();flush();},
    restore(y){window.scrollY=y;handlers.pageshow();flush();},
  };
}
const phone=fixture(true);
assert.equal(phone.collapsed(),false);
phone.scroll(400);assert.equal(phone.collapsed(),true);
phone.scroll(300);assert.equal(phone.collapsed(),true);
phone.scroll(20);assert.equal(phone.collapsed(),true);
phone.scroll(1);assert.equal(phone.collapsed(),true);
phone.scroll(0);assert.equal(phone.collapsed(),false);
phone.restore(40);assert.equal(phone.collapsed(),true);
assert.equal(fixture(true,50).collapsed(),true);
const desktop=fixture(false);
desktop.scroll(400);assert.equal(desktop.collapsed(),true);
desktop.scroll(350);assert.equal(desktop.collapsed(),false);
console.log('Profile tests passed: mobile opens only at the top; desktop direction behavior preserved.');
