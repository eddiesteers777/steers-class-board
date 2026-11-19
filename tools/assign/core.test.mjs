// Assignments rules check: node tools/assign/core.test.mjs (no browser, no network). Uses made-up problems only.
import * as C from "../../js/assignCore.js";
import assert from "node:assert/strict";
const pool = [{q:"1+1",a:"2"},{q:"2+2",a:"4"},{q:"3+3",a:"6"},{q:"{1/2}+{1/4}",a:"{3/4}",also:["0.75"]}].map(C.cleanItem);
const mc = [{q:"Pick",a:"B",choices:["A","B","C"]}].map(C.cleanItem);
const def = { id:"x1", title:"T", type:"practice", code:"123456", opts:{need:2,tries:2}, skills:[{k:"s0",name:"Add",std:"7.1",pool},{k:"s1",name:"MC",std:"7.2",pool:mc,need:1}] };
assert.equal(C.isRight(pool[3], "3/4"), true); assert.equal(C.isRight(pool[3], "0.75"), true); assert.equal(C.isRight(pool[3], "1/2"), false);
assert.equal(C.isRight(mc[0], "B"), true); assert.equal(C.triesFor(mc[0], def.opts), 1);
// student flow
const seed = C.seedOf("123456","1st","#0"); let log=[];
let st = C.skillState(def.skills[0],0,log,def.opts); let i = C.nextProblem(def.skills[0], st, seed);
const ex = C.exampleFor(def.skills[0], seed); assert.notEqual(ex, i);
log.push({k:0,i,y:"999",o:0,t:5}); st=C.skillState(def.skills[0],0,log,def.opts); assert.ok(st.cur, "still open after 1 miss");
log.push({k:0,i,y:"998",o:0,t:5}); st=C.skillState(def.skills[0],0,log,def.opts); assert.equal(st.cur,null); 
const i2=C.nextProblem(def.skills[0], st, seed); assert.notEqual(i2,i);
log.push({k:0,i:i2,y:pool[i2].a,o:1,t:5}); 
const i3=C.nextProblem(def.skills[0], C.skillState(def.skills[0],0,log,def.opts), seed); log.push({k:0,i:i3,y:"",o:3});
const i4=C.nextProblem(def.skills[0], C.skillState(def.skills[0],0,log,def.opts), seed); log.push({k:0,i:i4,y:pool[i4].a,o:1});
st=C.skillState(def.skills[0],0,log,def.opts); assert.equal(st.right,2); assert.equal(st.mastered,true);
// forged o=1 does not count on teacher check
const forged=[{k:1,i:0,y:"A",o:1}];
const sc = C.practiceScore(def.skills, log.concat(forged), def.opts, C.keyCheck(def)); assert.equal(sc.parts[1].right,0); assert.equal(sc.grade, 0.5);
const rows = C.scoreRows(def, C.joinEntries([{id:"u1",data:{per:"1st",ni:0,lg:log.concat(forged)}},{id:"u2",data:{per:"1st",ni:0,lg:[{k:1,i:0,y:"B",o:1,at:9}]}}], {"1st":["Ava R.","Ben S."]}));
assert.equal(rows.length,1); assert.equal(rows[0].devices,2); assert.equal(rows[0].grade,1); assert.equal(rows[0].nm,"Ava R.");
const P = C.toProgress(def,"1st",rows,["Ava Rodriguez"]); assert.equal(P.imp.rows[0].s,"Ava Rodriguez"); assert.equal(P.imp.rows[0].v[0],1); assert.ok(P.det.st[0].lg.length>=4); console.log(P.det.st[0].lg, P.det.qs.length);
// test
const tdef={id:"t1",title:"Quiz",type:"test",code:"222222",opts:{},skills:[{k:"a",name:"A",pool,w:2},{k:"b",name:"B",pool:mc,w:1}]};
const tseed=C.seedOf("222222","1st","#1"); const items=C.testItems(tdef.skills,tseed);
const trows=C.scoreRows(tdef, C.joinEntries([{id:"u3",data:{per:"1st",ni:1,done:true,ans:{0:{i:items[0],y:"nope"},1:{i:0,y:"B"}}}}],{"1st":["Ava R.","Ben S."]}));
assert.equal(Math.round(trows[0].grade*1000),333); assert.equal(trows[0].complete,1);
const who=C.missedByStudent(tdef,trows); assert.deepEqual(who["1st|#1"].q,[0]);
const fdef={id:"f1",title:"Quiz fix",type:"fix",code:"333333",opts:{back:0.5},skills:tdef.skills,fix:{who}};
const frows=C.scoreRows(fdef,C.joinEntries([{id:"u3",data:{per:"1st",ni:1,lg:[{k:0,i:items[0],y:pool[items[0]].a,o:1}]}}],{"1st":["Ava R.","Ben S."]}));
console.log(frows[0].before, frows[0].after); assert.ok(Math.abs(frows[0].after-(1/3+0.5*2/3))<1e-3);
console.log(C.estimateMins(def), C.tableCsv(C.gradeTable([{def,rows},{def:tdef,rows:trows}],["Ava R.","Ben S."])));
const pub=C.publicDoc(tdef,{"1st":["Ava R."]},"uid"); assert.equal(pub.skills[0].pool[0].a, undefined);
const pub2=C.publicDoc(Object.assign({},def,{opts:{pass:"Lion"}}),{},"uid"); assert.ok(C.passOk(pub2,"123456","lion ")); assert.ok(!C.passOk(pub2,"123456","tiger"));
console.log("ok");
