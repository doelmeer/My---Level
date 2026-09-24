import { createClient } from '@supabase/supabase-js';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url,key) : null;

const app=document.querySelector('#app');
const state={session:null,profile:null,activities:[],plans:[],page:'home'};

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const xpWeight={Learning:1,Fitness:1.15,Work:1.17,Creativity:1.1,Recovery:.5,Finance:1,Spiritual:1};
const icon={Learning:'📚',Fitness:'🏃',Work:'💼',Creativity:'🎨',Recovery:'😴',Finance:'💰',Spiritual:'🕌'};

function shell(){
 app.innerHTML=`<div class="layout"><aside><div class="logo">Life<span>XP</span></div><nav>
 ${['home','plan','activity','leaderboard','profile'].map(p=>`<button data-page="${p}">${{home:'⌂ Dashboard',plan:'▣ Plan',activity:'＋ Activity',leaderboard:'♛ Leaderboard',profile:'◉ Profile'}[p]}</button>`).join('')}</nav><div class="sidefoot">Real-life progress, gamified.</div></aside>
 <main><header><div><h1 id="title">Dashboard</h1><p id="sub">Turn real-life progress into XP.</p></div><div id="userBadge"></div></header><section id="content"></section></main>
 </div>`;
 document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;render()});
}

function auth(){
 app.innerHTML=`<div class="auth"><div class="authcard"><div class="logo">Life<span>XP</span></div><h1>Turn real life into a game.</h1><p>Plan. Do. Earn XP. Level up.</p>
 <input id="email" type="email" placeholder="Email"><input id="password" type="password" placeholder="Password">
 <button class="primary" id="signin">Sign in</button><button class="secondary" id="signup">Create account</button>
 <div class="or">or</div><button class="google" id="google">Continue with Google</button><small>By continuing, you agree to use LifeXP responsibly.</small></div></div>`;
 signin.onclick=async()=>authEmail(false); signup.onclick=async()=>authEmail(true);
 google.onclick=async()=>{if(!supabase)return alert('Configure Supabase first.'); await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin}})};
}
async function authEmail(create){
 if(!supabase)return alert('Open the project after configuring .env from .env.example.');
 const email=document.querySelector('#email').value.trim(),password=document.querySelector('#password').value;
 if(!email||password.length<6)return alert('Enter a valid email and a password of at least 6 characters.');
 const r=create?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});
 if(r.error)alert(r.error.message); else if(create)alert('Account created. Check your email if confirmation is enabled.');
}
async function load(){
 if(!supabase){state.session={user:{email:'demo@lifexp.app',id:'demo'}};state.profile={display_name:'Demo User',username:'demo',global_xp:18420,streak:17};state.activities=[];state.plans=[];return;}
 const {data:{session}}=await supabase.auth.getSession(); state.session=session;
 if(!session)return;
 const uid=session.user.id;
 let p=await supabase.from('profiles').select('*').eq('id',uid).maybeSingle();
 state.profile=p.data;
 if(!state.profile){await supabase.from('profiles').insert({id:uid,display_name:session.user.email?.split('@')[0]||'User',username:'user_'+uid.slice(0,8)});p=await supabase.from('profiles').select('*').eq('id',uid).single();state.profile=p.data;}
 const [a,pl]=await Promise.all([
  supabase.from('activities').select('*').eq('user_id',uid).order('started_at',{ascending:false}).limit(50),
  supabase.from('plans').select('*').eq('user_id',uid).order('scheduled_for',{ascending:true}).limit(30)
 ]);
 state.activities=a.data||[];state.plans=pl.data||[];
}
async function addActivity(name,category,minutes){
 const xp=Math.round(minutes*(xpWeight[category]||1));
 if(!supabase){state.activities.unshift({name,category,minutes,xp,started_at:new Date().toISOString()});state.profile.global_xp+=xp;return xp;}
 const uid=state.session.user.id;
 const {error}=await supabase.rpc('log_activity',{p_name:name,p_category:category,p_minutes:minutes});
 if(error)throw error;
 await load();return xp;
}
async function completePlan(id){
 if(!supabase){const p=state.plans.find(x=>x.id===id);if(p)p.completed=true;return;}
 const {error}=await supabase.rpc('complete_plan',{p_plan_id:id});if(error)throw error;await load();
}
function card(html,cls='card'){return `<div class="${cls}">${html}</div>`}
function render(){
 if(!state.session)return auth();
 shell();
 const title={home:'Dashboard',plan:'Today’s Plan',activity:'Activity History',leaderboard:'Leaderboard',profile:'Profile'}[state.page];
 document.querySelector('#title').textContent=title;
 document.querySelector('#userBadge').innerHTML=`<span class="avatar">${esc((state.profile?.display_name||'U')[0].toUpperCase())}</span>`;
 const c=document.querySelector('#content');
 if(state.page==='home')home(c); if(state.page==='plan')plan(c);if(state.page==='activity')activity(c);if(state.page==='leaderboard')leaders(c);if(state.page==='profile')profile(c);
}
function home(c){
 const xp=state.profile?.global_xp||0,level=Math.floor(xp/1000)+1,into=xp%1000;
 c.innerHTML=`<div class="hero"><div class="muted">GLOBAL LEVEL</div><div class="heroRow"><b>LV ${level}</b><span>${xp.toLocaleString()} XP</span></div><div class="progress"><i style="width:${into/10}%"></i></div><div class="stats"><div><b>🔥 ${state.profile?.streak||0}</b><span>day streak</span></div><div><b>+${state.activities.reduce((s,a)=>s+(a.xp||0),0)}</b><span>loaded XP</span></div><div><b>${state.activities.reduce((s,a)=>s+(a.minutes||0),0)}m</b><span>logged time</span></div></div></div>
 <div class="two">${card(`<h2>Today’s Plan</h2>${state.plans.slice(0,4).map(planRow).join('')||'<p class="muted">No plans yet.</p>')}<button class="primary" onclick="state.page='plan';render()">Open planning</button>`)}
 ${card(`<h2>Quick Log</h2><p class="muted">Record a completed activity and earn XP.</p><button class="primary" onclick="quickLog()">＋ Log activity</button>`)}
 </div>`;
}
function planRow(p){return `<div class="row"><span class="emoji">${icon[p.category]||'⭐'}</span><div class="grow"><b>${esc(p.name)}</b><small>${esc(p.category)} · ${p.duration_minutes} min</small></div>${p.completed?'<span class="green">✓</span>':`<button class="secondary small" onclick="finishPlan('${p.id}')">Complete</button>`}</div>`}
function plan(c){c.innerHTML=card(`<div class="between"><h2>Plan your day</h2><button class="primary" onclick="newPlan()">＋ Add plan</button></div>${state.plans.map(planRow).join('')||'<p class="muted">Create your first plan.</p>'}`)}
function activity(c){c.innerHTML=card(`<div class="between"><h2>Activity history</h2><button class="primary" onclick="quickLog()">＋ Log</button></div>${state.activities.map(a=>`<div class="row"><span class="emoji">${icon[a.category]||'⭐'}</span><div class="grow"><b>${esc(a.name)}</b><small>${esc(a.category)} · ${a.minutes} min</small></div><strong class="green">+${a.xp} XP</strong></div>`).join('')||'<p class="muted">No activity logged yet.</p>'}`)}
function leaders(c){const rows=[['Maya','1,840'],['Jordan','1,110'],['Lina','980'],['Noah','910'],['Sofia','860'],['Omar','790']];c.innerHTML=card(`<div class="between"><h2>Learning · This Week</h2><select><option>This Week</option><option>This Month</option><option>This Season</option></select></div><div class="leader"><b>#1</b><span>Maya</span><strong>1,840 XP</strong></div><div class="leader you"><b>#2</b><span>You</span><strong>${(state.profile?.global_xp||0).toLocaleString()} XP</strong></div>${rows.slice(1).map((x,i)=>`<div class="leader"><b>#${i+3}</b><span>${x[0]}</span><strong>${x[1]} XP</strong></div>`).join('')}`)}
function profile(c){const p=state.profile||{};c.innerHTML=`${card(`<div class="profileHead"><span class="avatar big">${esc((p.display_name||'U')[0].toUpperCase())}</span><div><h2>${esc(p.display_name||'User')}</h2><p class="muted">@${esc(p.username||'user')}</p></div></div>`)}<div class="two">${card(`<h2>Stats</h2><p><b>${(p.global_xp||0).toLocaleString()}</b> total XP</p><p><b>${p.streak||0}</b> day streak</p>`)}${card(`<h2>Privacy</h2><label><input type="checkbox" ${p.is_public===false?'':'checked'} onchange="privacy(this.checked)"> Public profile</label><p class="muted">Control who can discover your progress.</p><button class="secondary" onclick="logout()">Sign out</button>`)}</div>`}
window.quickLog=async()=>{const name=prompt('Activity name','Study session');if(!name)return;const cat=prompt('Category: Learning, Fitness, Work, Creativity, Recovery','Learning')||'Learning';const min=Number(prompt('Minutes','30'))||30;try{const xp=await addActivity(name,cat,min);render();alert(`+${xp} XP earned`)}catch(e){alert(e.message)}};
window.newPlan=async()=>{const name=prompt('Plan name','Study session');if(!name)return;const min=Number(prompt('Duration (minutes)','30'))||30;const cat=prompt('Category','Learning')||'Learning';if(!supabase){state.plans.push({id:crypto.randomUUID(),name,category:cat,duration_minutes:min,completed:false});render();return;}const {error}=await supabase.from('plans').insert({user_id:state.session.user.id,name,category:cat,duration_minutes:min,scheduled_for:new Date().toISOString()});if(error)alert(error.message);else{await load();render()}};
window.finishPlan=async id=>{try{await completePlan(id);render()}catch(e){alert(e.message)}};
window.privacy=async v=>{if(supabase)await supabase.from('profiles').update({is_public:v}).eq('id',state.session.user.id);state.profile.is_public=v};
window.logout=async()=>{if(supabase)await supabase.auth.signOut();state.session=null;render()};
async function start(){await load();render();if(supabase)supabase.auth.onAuthStateChange(async()=>{await load();render()})}
start();