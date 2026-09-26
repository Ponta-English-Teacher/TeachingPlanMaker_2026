import {test,expect} from '@playwright/test';
import {contextFor,newPlan,samplePlan,totalMinutes,storageSchema} from '../src/lib/plans';
test('later planning context cannot leak backwards',()=>{
 const p=samplePlan();p.reflection.worked='Private reflection';
 const general=contextFor(p,'general');expect(general).not.toHaveProperty('timeline');expect(general).not.toHaveProperty('slides');expect(general).not.toHaveProperty('reflection');
 const detailed=contextFor(p,'timeline');expect(detailed).toHaveProperty('timeline');expect(detailed).not.toHaveProperty('slides');
 const visuals=contextFor(p,'visuals');expect(visuals).toHaveProperty('timeline');expect(visuals).toHaveProperty('slides');expect(visuals).not.toHaveProperty('reflection');
 expect(contextFor(p,'reflection')).toHaveProperty('reflection');
});
test('sample aligns its sequence, timing, and disclosure order',()=>{
 const p=samplePlan();expect(p.timeline).toHaveLength(14);expect(p.slides).toHaveLength(14);expect(totalMinutes(p)).toBe(100);
 expect(p.slides.slice(0,5).some(s=>s.values.content.includes('Systemic'))).toBe(false);expect(p.slides[5].values.content).toContain('Systemic');
 expect([...p.timeline,...p.slides,...p.boards].every(r=>!r.show)).toBe(true);
 expect(storageSchema.safeParse({version:1,plans:[p]}).success).toBe(true);
 const blank=newPlan();expect(blank.general.duration).toBe('');
});
