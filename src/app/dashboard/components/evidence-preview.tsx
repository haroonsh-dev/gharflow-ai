"use client";
import { t } from "@/lib/copy";
import { useEffect,useRef,useState } from "react";
import type { Extraction } from "@/lib/schemas";
export default function EvidencePreview({id,extraction,selected}:{id:string|null;extraction:Extraction|null;selected:string|null}){
  const [chosenPage,setPage]=useState(1);
  const marker=useRef<HTMLSpanElement>(null);
  const candidate=selected?extraction?.candidates[selected]:undefined;
  const page=candidate?.page??chosenPage;
  useEffect(()=>{if(candidate)marker.current?.scrollIntoView({block:"nearest",behavior:"smooth"});},[candidate]);
  if(!id)return <div className="preview-empty">{t("Upload a document to inspect its source. Manual entry is available.")}</div>;
  if(!extraction?.pages.length)return <div><p className="fine-print">{t("Source regions are unavailable. Inspect the original, then enter fields manually.")}</p><a className="text-button" href={`/api/files/${id}`} target="_blank" rel="noreferrer">{t("Open original document")}</a><iframe title={t("Original bill document")} className="original-preview" src={`/api/files/${id}?inline=1`} sandbox=""/></div>;
  return <div><div className="preview-toolbar"><span>{t("Document source · page")}{page}</span><div>{extraction.pages.map((item)=><button className={`button button-outline ${item.page===page?"selected-page":""}`} key={item.page} onClick={()=>setPage(item.page)} type="button" aria-label={`View document page ${item.page}`}>{item.page}</button>)}</div></div><div className="source-canvas">
    {/* Private raster previews need cookie authentication, so the browser loads them directly. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`/api/files/${id}?preview=${page}`} alt={`Uploaded bill page ${page}`}/>
    {candidate&&<span ref={marker} className="source-highlight" aria-label={t("OCR source region")} style={{left:`${candidate.box.x*100}%`,top:`${candidate.box.y*100}%`,width:`${candidate.box.width*100}%`,height:`${candidate.box.height*100}%`}}/>}
  </div>{candidate&&<p className="fine-print">{t("Extracted:")}{candidate.value} {t("· OCR signal")}{candidate.confidence===null?"unavailable":`${candidate.confidence}/100`}{t(". This signal is not an accuracy guarantee.")}</p>}<a className="text-button" href={`/api/files/${id}`}>{t("Download original")}</a></div>;
}
