import React,{createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react'
import {createClient} from '@supabase/supabase-js'
import {DEMO_KEY,INITIAL_TEAMS,INITIAL_CRITERIA,INITIAL_SETTINGS,INITIAL_PROFILES} from './data.js'

const url=import.meta.env.VITE_SUPABASE_URL
const key=import.meta.env.VITE_SUPABASE_KEY
const isLive=!!(url&&key)
const supabase=isLive?createClient(url,key):null
const ctx=createContext(null)
function demoSeed(){return {teams:INITIAL_TEAMS,criteria:INITIAL_CRITERIA,settings:INITIAL_SETTINGS,profiles:INITIAL_PROFILES,scores:[],votes:[],codes:[]}}
function readDemo(){try{const v=JSON.parse(localStorage.getItem(DEMO_KEY));return v?{...demoSeed(),...v}:demoSeed()}catch{return demoSeed()}}

export function CompetitionProvider({children}){
  const [data,setData]=useState(()=>isLive?{teams:[],criteria:[],settings:null,profiles:[],scores:[],votes:[],codes:[]}:readDemo())
  const [user,setUser]=useState(null)
  const [role,setRole]=useState('admin')
  const [profile,setProfile]=useState(null)
  const [loading,setLoading]=useState(isLive)
  const [error,setError]=useState('')
  const demo=!isLive
  const demoProfile=demo?data.profiles.find(p=>p.id===(role==='admin'?'demo-admin':'demo-judge')):null
  const currentUser=demo?{id:demoProfile?.id||'demo-admin'}:user
  const currentProfile=demo?demoProfile:profile

  useEffect(()=>{
    if(!isLive)return
    supabase.auth.getUser().then(({data:r})=>setUser(r.user||null)).catch(e=>setError(e.message))
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_evt,session)=>setUser(session?.user||null))
    return ()=>subscription.unsubscribe()
  },[])

  const refresh=useCallback(async()=>{
    if(!isLive)return
    try{
      const [teams,criteria,settings,prof]=await Promise.all([
        supabase.from('teams').select('*').order('display_order'),
        supabase.from('criteria').select('*').order('display_order'),
        supabase.from('event_settings').select('*').eq('id',1).single(),
        user?supabase.from('profiles').select('*').eq('id',user.id).maybeSingle():Promise.resolve({data:null})
      ])
      for(const r of [teams,criteria,settings,prof])if(r.error)throw r.error
      const myProfile=prof.data
      setProfile(myProfile)
      const admin=myProfile?.role==='admin' && myProfile.active
      const judge=myProfile?.role==='judge' && myProfile.active
      let extra={profiles:[],scores:[],votes:[],codes:[]}
      if(admin){
        const [p,s,v,c]=await Promise.all([
          supabase.from('profiles').select('*').order('display_name'),
          supabase.from('scores').select('*'),
          supabase.from('votes').select('team_id'),
          supabase.from('voter_codes').select('id,used_at')
        ])
        for(const r of [p,s,v,c])if(r.error)throw r.error
        extra={profiles:p.data||[],scores:s.data||[],votes:v.data||[],codes:c.data||[]}
      }else if(judge){
        const s=await supabase.from('scores').select('*').eq('judge_id',user.id)
        if(s.error)throw s.error
        extra={...extra,profiles:[myProfile],scores:s.data||[]}
      }
      setData({teams:teams.data||[],criteria:criteria.data||[],settings:settings.data, ...extra})
      setError('')
    }catch(e){setError(e.message||'Could not load competition data.')}
    finally{setLoading(false)}
  },[user])

  useEffect(()=>{if(!isLive)return;refresh();const timer=setInterval(refresh,12000);return()=>clearInterval(timer)},[refresh])
  useEffect(()=>{if(!demo)return;localStorage.setItem(DEMO_KEY,JSON.stringify(data))},[data,demo])
  function updateDemo(fn){setData(prev=>fn(prev))}
  async function signIn(email,password){
    if(demo)return
    const {error}=await supabase.auth.signInWithPassword({email,password})
    if(error)throw error
  }
  async function signOut(){if(demo){setRole('admin');return};const {error}=await supabase.auth.signOut();if(error)throw error;setProfile(null)}
  async function saveScores(teamId,values){
    if(!currentProfile||currentProfile.role!=='judge'||!currentProfile.active)throw Error('Judge access required.')
    if(!data.settings?.scoring_open)throw Error('Judging is closed.')
    const rows=data.criteria.map((c,i)=>({judge_id:currentUser.id,team_id:teamId,criterion_id:c.id,points:Number(values[i])}))
    rows.forEach((r,i)=>{if(!Number.isInteger(r.points)||r.points<0||r.points>Number(data.criteria[i].max_points))throw Error('A score is outside its allowed range.')})
    if(demo){updateDemo(prev=>({...prev,scores:[...prev.scores.filter(s=>!(s.judge_id===currentUser.id&&s.team_id===teamId)),...rows]}));return}
    const {error}=await supabase.from('scores').upsert(rows,{onConflict:'judge_id,team_id,criterion_id'})
    if(error)throw error;await refresh()
  }
  async function updateSettings(patch){
    if(currentProfile?.role!=='admin')throw Error('Admin access required.')
    if(demo){updateDemo(prev=>({...prev,settings:{...prev.settings,...patch}}));return}
    const {error}=await supabase.from('event_settings').update(patch).eq('id',1)
    if(error)throw error;await refresh()
  }
  async function updateCriteria(edited){
    if(currentProfile?.role!=='admin')throw Error('Admin access required.')
    if(data.scores.length)throw Error('Criteria are locked once any judging score exists.')
    const total=edited.reduce((sum,c)=>sum+Number(c.max_points),0)
    if(total!==100||edited.some(c=>!c.name.trim()||!Number.isInteger(Number(c.max_points))||Number(c.max_points)<1))throw Error('Criteria must have positive integer maximums that total 100 points.')
    if(demo){updateDemo(prev=>({...prev,criteria:edited}));return}
    for(const c of edited){
      const {error}=await supabase.from('criteria').update({name:c.name,max_points:Number(c.max_points)}).eq('id',c.id)
      if(error)throw error
    }
    await refresh()
  }
  async function issueCodes(newCodes){
    if(currentProfile?.role!=='admin')throw Error('Admin access required.')
    if(demo){updateDemo(prev=>({...prev,codes:[...prev.codes,...newCodes.map((code,i)=>({id:Date.now()+i,raw_code:code,used_at:null}))]}));return newCodes.length}
    const {data:inserted,error}=await supabase.rpc('issue_voter_codes',{p_codes:newCodes})
    if(error)throw error;await refresh();return inserted
  }
  async function castVote(code,teamId){
    if(!data.settings?.voting_open)throw Error('Voting is closed.')
    if(demo){
      const matching=data.codes.find(c=>c.raw_code?.toUpperCase()===code.toUpperCase().trim())
      if(!matching||matching.used_at)throw Error('Invalid or already-used voter code.')
      updateDemo(prev=>({...prev,codes:prev.codes.map(c=>c.id===matching.id?{...c,used_at:new Date().toISOString()}:c),votes:[...prev.votes,{team_id:teamId}]}))
      return 'Vote accepted!'
    }
    const {data:message,error}=await supabase.rpc('cast_vote',{p_code:code.toUpperCase().trim(),p_team_id:teamId})
    if(error)throw error
    return message
  }
  function resetDemo(){if(demo){const fresh=demoSeed();setData(fresh);localStorage.setItem(DEMO_KEY,JSON.stringify(fresh))}}
  const value=useMemo(()=>({data,user:currentUser,profile:currentProfile,loading,error,demo,role,setRole,refresh,signIn,signOut,saveScores,updateSettings,updateCriteria,issueCodes,castVote,resetDemo}),[data,currentUser?.id,currentProfile?.id,currentProfile?.role,loading,error,demo,role,refresh])
  return <ctx.Provider value={value}>{children}</ctx.Provider>
}
export const useCompetition=()=>useContext(ctx)
