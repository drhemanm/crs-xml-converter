import { test, expect } from '@playwright/test';
import { appendFileSync } from 'node:fs';
for(const n of [1000,5000,10000,20000]) {
 test(`synthetic CRS browser filing and local persistence: ${n} accounts`,async({page})=>{
  test.setTimeout(90000);
  await page.addInitScript(()=>{(window as any).__stressLongTasks=[];new PerformanceObserver(list=>(window as any).__stressLongTasks.push(...list.getEntries().map(e=>e.duration))).observe({entryTypes:['longtask']});});
  const pageErrors:string[]=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.getByLabel('Institution name').fill('Synthetic FI');await page.getByLabel(/^Institution (TAN|TIN|UEN|GIIN|identifier)$/).fill('MU10203040');await page.getByLabel('Institution city').fill('Port Louis');
  await page.getByLabel('Reporting period end').fill('2026-12-31');await page.getByLabel('Filing date').fill('2027-03-01');
  const csv='account_number,account_balance,currency_code,holder_type,residence_country,first_name,last_name,birth_date,tin,address_street,address_city,self_cert,account_type,dd_procedure\n'+Array.from({length:n},(_,i)=>`SYN-${i},1000.00,USD,individual,FR,Synthetic,Customer${i},1985-03-14,FR7712345678,1 Test Street,Paris,true,depository,preexisting`).join('\n');
  const uploadStart=Date.now();await page.setInputFiles('input[type="file"][accept*="csv"]',{name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await expect(page.getByText(`${n} record(s) mapped`,{exact:false})).toBeVisible();const uploadMs=Date.now()-uploadStart;
  const generateStart=Date.now();await page.getByRole('button',{name:'Generate return'}).click();await expect(page.locator('pre.xml')).toBeVisible({timeout:60000});const generateMs=Date.now()-generateStart;
  const counts=await page.locator('pre.xml').evaluate(el=>({accounts:(el.textContent?.match(/<AccountReport>/g)??[]).length,xmlChars:el.textContent?.length,firstAccountRef:el.textContent?.match(/<AccountReport>[\s\S]*?<stf:DocRefId>([^<]+)<\/stf:DocRefId>/)?.[1]}));expect(counts.accounts).toBe(n);
  const messageRef=(await page.getByTestId('message-ref-id').innerText()).trim();
  await page.getByRole('button',{name:'Record in local history'}).click();
  // History appears only after the IndexedDB transaction has committed.
  await expect(page.getByRole('button',{name:'Record in local history'})).toHaveCount(0,{timeout:30000});
  const info=await page.evaluate(async()=>{
    const saved:any=await new Promise((resolve,reject)=>{const open=indexedDB.open('crs-filing-history',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result;const tx=db.transaction('ledger','readonly');const req=tx.objectStore('ledger').get('current');req.onsuccess=()=>resolve(req.result);tx.oncomplete=()=>db.close();};});
    return {storedChars:JSON.stringify(saved.entries).length,storedEntries:saved.entries.length,longTasks:(window as any).__stressLongTasks as number[],memory:(performance as any).memory?.usedJSHeapSize};
  });
  const text=await page.locator('body').innerText();
  const result={product:'FilingBridge',scenario:'browserLocalMode',n,uploadMs,generateMs,...counts,storedChars:info.storedChars,maxLongTaskMs:Math.max(0,...info.longTasks),totalLongTaskMs:info.longTasks.reduce((a,b)=>a+b,0),browserHeapMiB:info.memory/2**20,pageErrors,quotaText:text.includes('quota')||text.includes('Quota')};
  const resultsFile = process.env['STRESS_RESULTS_FILE'];
  if (resultsFile) appendFileSync(resultsFile, JSON.stringify(result)+'\n');
  console.log(JSON.stringify(result));
  expect(info.storedChars,'filing history must be persisted').toBeGreaterThan(0);
  expect(info.storedEntries).toBe(n+1);
  await page.reload();await page.getByRole('button',{name:/Filing history/}).click();await expect(page.locator('tbody tr')).toHaveCount(n+1,{timeout:30000});
  if(n===20000) {
    await page.setInputFiles('input[type="file"][accept*="xml"]',{name:'status.xml',mimeType:'application/xml',buffer:Buffer.from(`<CRSStatusMessage_OECD xmlns="urn:oecd:ties:csm:v1" version="1.0"><MessageSpec><MessageRefId>SyntheticStatus</MessageRefId></MessageSpec><CrsStatusMessage><OriginalMessage><OriginalMessageRefID>${messageRef}</OriginalMessageRefID></OriginalMessage><ValidationErrors/><ValidationResult><Status>Accepted</Status><ValidatedBy>test</ValidatedBy></ValidationResult></CrsStatusMessage></CRSStatusMessage_OECD>`)});
    await expect(page.locator('.state.live')).toHaveCount(n+1,{timeout:30000});
    await page.reload();
    await page.getByLabel('Institution name').fill('Synthetic FI');await page.getByLabel(/^Institution (TAN|TIN|UEN|GIIN|identifier)$/).fill('MU10203040');await page.getByLabel('Institution city').fill('Port Louis');
    await page.getByLabel('Reporting period end').fill('2026-12-31');await page.getByLabel('Filing date').fill('2027-03-01');await page.getByRole('button',{name:'Correction',exact:true}).click();
    const correctedCsv=csv.split('\n').slice(0,2).join('\n').replace('SYN-0,1000.00','SYN-0,1500.00');
    await page.setInputFiles('input[type="file"][accept*="csv"]',{name:'correction.csv',mimeType:'text/csv',buffer:Buffer.from(correctedCsv)});
    await expect(page.getByText('1 record(s) mapped',{exact:false})).toBeVisible();await page.getByRole('button',{name:'Generate return'}).click();
    await expect(page.locator('pre.xml')).toContainText(`<stf:CorrDocRefId>${counts.firstAccountRef}</stf:CorrDocRefId>`,{timeout:30000});
  }
 });
}

test('duplicate CSV account rows are blocked before generating a return',async({page})=>{
 await page.goto('/');await page.getByLabel('Institution name').fill('Synthetic FI');await page.getByLabel(/^Institution (TAN|TIN|UEN|GIIN|identifier)$/).fill('MU10203040');await page.getByLabel('Institution city').fill('Port Louis');
 const row='SYN-1,1000.00,USD,individual,FR,Synthetic,Customer,1985-03-14,FR7712345678,1 Test Street,Paris,true,depository,preexisting';
 const csv='account_number,account_balance,currency_code,holder_type,residence_country,first_name,last_name,birth_date,tin,address_street,address_city,self_cert,account_type,dd_procedure\n'+row+'\n'+row;
 await page.setInputFiles('input[type="file"][accept*="csv"]',{name:'duplicate.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await expect(page.getByText('2 record(s) mapped',{exact:false})).toBeVisible();await page.getByRole('button',{name:'Generate return'}).click();
 await expect(page.locator('.diagnostic.error,pre.xml').first()).toBeVisible();
 expect(await page.locator('pre.xml').count(),'duplicate account rows must not generate filing XML').toBe(0);
});
