export const INITIAL_TEAMS = [
  {id:'bastion',name:'Bastion',display_order:1},
  {id:'catalyst',name:'Catalyst',display_order:2},
  {id:'sentinel',name:'Sentinel',display_order:3},
  {id:'vanguard',name:'Vanguard',display_order:4}
]
export const INITIAL_CRITERIA = [
  {id:1,name:'Message & Biblical Relevance',max_points:25,display_order:1},
  {id:2,name:'Creativity & Originality',max_points:25,display_order:2},
  {id:3,name:'Cinematography & Editing',max_points:20,display_order:3},
  {id:4,name:'Musical Performance',max_points:20,display_order:4},
  {id:5,name:'Overall Impact',max_points:10,display_order:5}
]
export const INITIAL_SETTINGS = {id:1,event_title:'Music Video Awards',expected_judges:null,scoring_open:true,voting_open:true,results_released:false}
export const INITIAL_PROFILES = [
  {id:'demo-admin',display_name:'Event Administrator',role:'admin',active:true},
  {id:'demo-judge',display_name:'Demo Judge',role:'judge',active:true}
]
export const DEMO_KEY='music-video-awards-demo-v1'
export const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function makeCodes(count){
  const codes=new Set()
  while(codes.size<count){
    const buf=new Uint8Array(12)
    crypto.getRandomValues(buf)
    codes.add('MVA-'+Array.from(buf,v=>ALPHABET[v%ALPHABET.length]).join(''))
  }
  return [...codes]
}
export function scoreSummary(teams,criteria,scores,profiles,expected){
  return teams.map(team=>{
    const entries=profiles.filter(p=>p.role==='judge' && p.active).map(p=>{
      const rows=scores.filter(s=>s.team_id===team.id && s.judge_id===p.id)
      const complete=criteria.length>0 && criteria.every(c=>rows.some(r=>String(r.criterion_id)===String(c.id)))
      return {judge:p,complete,total:complete?rows.reduce((a,r)=>a+Number(r.points),0):null}
    })
    const completed=entries.filter(e=>e.complete)
    const average=completed.length?completed.reduce((a,e)=>a+e.total,0)/completed.length:null
    return {...team,average,completed:completed.length,expected,entries}
  })
}
export function downloadText(filename,text,mime='text/plain'){
  const blob=new Blob([text],{type:mime}); const url=URL.createObjectURL(blob)
  const a=document.createElement('a');a.href=url;a.download=filename;a.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
