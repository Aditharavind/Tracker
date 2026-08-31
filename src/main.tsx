import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SharedView from "./components/SharedView";
import JoinLobby from "./components/JoinLobby";
import ForestScene from "./components/forest/ForestScene";
import { useState as _us, useEffect as _ue } from "react";
import { registerSW } from "virtual:pwa-register";
import "@fontsource/press-start-2p";
import "./styles.css";

// autoUpdate: a new deploy is picked up on the next launch.
registerSW({ immediate: true });

const params = new URLSearchParams(location.search);
const shareToken = params.get("share");
const joinToken = params.get("join");


function _FSProbe() {
  const [n,setN]=_us(0);
  const tasks=[0,1,2,3].map(i=>({id:i,title:'T'+i,emoji:'*',is_core:true,locked:false,reps_target:null,done:i<n}));
  _ue(()=>{const t=setTimeout(()=>setN(v=>Math.min(4,v+1)),900);return ()=>clearTimeout(t);},[n]);
  return <div style={{position:'fixed',inset:0}}><ForestScene detail={{day:'2026-08-31',tasks,pending:[],note:''}} dayNumber={5} seed={'p:1'} resets={0} character={'koala'} onDayCleared={()=>console.log('CLEARED')} /></div>;
}

function Root() {
  if (params.has("__fs")) return <_FSProbe />;
  if (shareToken) return <SharedView token={shareToken} />;
  if (joinToken) return <JoinLobby token={joinToken} />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
