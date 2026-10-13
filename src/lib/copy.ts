import en from "./en.json";
// English is the shipped locale. Add a translated catalogue here when Urdu copy is reviewed.
const catalogue:Record<string,string>=en;
export function t(key:string):string{return catalogue[key]??key;}
