// Language preferences affect presentation and AI response language only.
export function requestLanguage(req) {
  return /(?:^|;\s*)citrus_language=zh(?:;|$)/.test(String(req.headers.cookie || '')) ? 'zh' : 'en';
}
export function localizeFallback(original, language, question = '') {
  if (language === 'zh') return original;
  const q = String(question).toLowerCase();
  if (/nh4|nh₄|氯化铵|盐析|salting|ammonium/.test(q)) return 'NH₄Cl dissociates into NH₄⁺ and Cl⁻, increasing the ionic strength of the aqueous phase. This can help hydrophobic volatile oil components separate from water. At school level, consider how an electrolyte changes dissolution and dispersion in a mixture.';
  if (/乳化|emuls/.test(q)) return 'Emulsification means small oil droplets remain dispersed in the aqueous phase. Vigorous mixing, impurities, insufficient settling or emulsifiers may contribute. Flag unusual records and compare them with other records at the same concentration.';
  if (/抑菌|大肠杆菌|菌|e\.?\s?coli|inhibit|antibacter/.test(q)) return 'Compare the blank control, emulsifier control and essential oil emulsion group. Larger zones suggest stronger observed inhibition, but interpretation also requires replicates, clear boundaries, diffusion properties and contamination checks. Classroom observations do not establish clinical effectiveness.';
  if (/对照|control/.test(q)) return 'Controls help establish whether the tested variable explains a difference. The 0% NH₄Cl control is the baseline for phase separation and yield; a Tween 80 control helps distinguish essential oil effects from emulsifier effects.';
  if (/得率|偏高|偏低|yield/.test(q)) return 'For an unusual yield, check peel and oil masses, container tare, possible water contamination, distillation time and completeness of phase separation. Compare group means, replicates and anomaly flags rather than relying on one value.';
  return 'Analyse the question through variables, observations, evidence and conclusions: identify the condition changed, describe the observed result, use data and controls to support your interpretation, and discuss possible errors.';
}
