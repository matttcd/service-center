import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from '../../server/node_modules/puppeteer/lib/puppeteer/puppeteer.js'
const base = process.env.VERIFY_URL || 'http://127.0.0.1:8181'
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):8181$/)
assert.equal((await fetch(`${base}/api/health`).then(r => r.json())).verification, 'service-center-isolated-tests')
const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:'admin@local.com',password:'Browser-updated-2026'}) }).then(r=>r.json())
assert.ok(login.token)
const api=async(route,method='GET',body)=>{const r=await fetch(`${base}/api${route}`,{method,headers:{Authorization:`Bearer ${login.token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.ok(r.ok,`${route}: ${JSON.stringify(data)}`);return data}
const profiles=(await api('/auth/profiles')).profiles
const tech=profiles.find(user=>user.role==='tecnico')
const customer=(await api('/bootstrap')).customers.find(customer=>customer.dni==='12456789') || await api('/customers','POST',{fullName:'Cliente regresión UI',dni:'12.456.789',phone:'1100000010',address:'Pruebas 123'})
assert.equal((await api('/bootstrap')).customers.find(c=>c.id===customer.id).dni,'12456789')
const create=async(model)=> (await api('/orders','POST',{customerId:customer.id,deviceType:'Celular',brand:'Samsung',model,conditions:'Sin observaciones',accessories:'Sin accesorios',noPin:true,diagnosisType:'visible',fix:'Cambio de módulo',issue:'Notas generales de pruebas',price:30000})).order
const ready=async(model)=>{const order=await create(model);await api(`/orders/${order.id}/status`,'POST',{status:'en_reparacion',assignedTo:tech.id});await api(`/orders/${order.id}/status`,'POST',{status:'terminado'});return order}
const aviso=await ready('Aviso regresión')
assert.ok((await api('/orders?q=12.456.789')).orders.some(order=>order.id===aviso.id))
const browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']})
const page=await browser.newPage();page.setDefaultTimeout(20000)
const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept())
const click=async(label,root='body')=>{await page.waitForFunction((label,root)=>[...document.querySelectorAll(`${root} button`)].some(n=>n.getClientRects().length&&!n.disabled&&n.textContent.trim()===label),{},label,root);const el=await page.evaluateHandle((label,root)=>[...document.querySelectorAll(`${root} button`)].find(n=>n.getClientRects().length&&!n.disabled&&n.textContent.trim()===label),label,root);await el.asElement().click();await el.dispose()}
const open=async(id)=>{await page.waitForSelector(`[data-order-id="${id}"]`);await page.click(`[data-order-id="${id}"]`);await page.waitForSelector('.ws-sheet')}
const goto=async(route)=>{await page.goto(`${base}/${route}`,{waitUntil:'domcontentloaded'});await page.waitForSelector('.sc-content h1')}
const clearToasts=async()=>{for(const button of await page.$$('[aria-label="Cerrar notificación"]')) if(await button.isVisible()) await button.click()}
const nextTab=async(tab)=>{await page.click(`#queue-${tab}`);await page.waitForSelector('.ws-sheet',{hidden:true})}
const waitOrder=async(id,predicate)=>{for(let i=0;i<100;i++){const order=(await api(`/orders/${id}`)).order;if(predicate(order))return order;await new Promise(resolve=>setTimeout(resolve,100))}throw new Error(`Sin actualización: ${id}`)}
try{
 await page.setRequestInterception(true)
 let slow=false,fail=false,failBootstrap=false
 page.on('request',async request=>{if(failBootstrap&&request.url().endsWith('/api/bootstrap'))return request.respond({status:503,contentType:'application/json',body:JSON.stringify({error:'Sincronización temporalmente no disponible'})});if(request.url().includes('/api/orders?')&&request.url().includes('status=terminado')){if(slow)await new Promise(resolve=>setTimeout(resolve,600));if(fail)return request.respond({status:503,contentType:'application/json',body:JSON.stringify({error:'Consulta de prueba no disponible'})})}return request.continue()})
 await page.setViewport({width:1366,height:768});await page.goto(`${base}/login`,{waitUntil:'domcontentloaded'});await page.waitForSelector('input[type=password]');await page.type('input[type=password]','Browser-updated-2026');await page.click('button[type=submit]');await page.waitForSelector('.sc-sidebar')
 await page.waitForFunction(()=>location.pathname==='/recepcion')
 assert.equal(await page.$('.ws-sheet'),null)
 await nextTab('avisar')
 const searchTop=await page.$eval('.ws-search',node=>node.getBoundingClientRect().top)
 const searchHeight=await page.$eval('.ws-search',node=>node.getBoundingClientRect().height)
 assert.equal(searchHeight,84)
 await page.type('.ws-search input','sin coincidencias regresión altura')
 await page.waitForFunction(()=>!document.querySelector('.ws-queue-row'))
 assert.equal(await page.$eval('.ws-search',node=>node.getBoundingClientRect().height),searchHeight,'La cola vacía conserva la altura del buscador')
 assert.equal(await page.$eval('.ws-search',node=>node.getBoundingClientRect().top),searchTop)
 await page.click('.ws-search input');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace')
 await open(aviso.id)
 assert.ok(Math.abs(await page.$eval('.ws-search',node=>node.getBoundingClientRect().top)-searchTop)<=1)
 assert.ok((await page.$eval('.ws-reference',node=>node.textContent)).includes('12.456.789'))
 await clearToasts();let noticePosts=0
 page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith(`/orders/${aviso.id}/notified`))noticePosts++})
 await click('Avisar al cliente');await page.$eval('[role=dialog] .ws-button.primary',node=>{node.click();node.click()})
 await page.waitForSelector('[role=dialog]',{hidden:true});await page.waitForSelector('.ws-sheet',{hidden:true});await waitOrder(aviso.id,o=>o.notified)
 assert.equal(noticePosts,1)
 assert.equal(await page.$$eval('[data-notification=error]',nodes=>nodes.length),0,'Un aviso guardado no puede mostrar también un error')
 assert.equal(await page.$$eval('[data-notification=success]',nodes=>nodes.length),1)
 // Un cambio desde otra PC cierra la ficha sin seleccionar la siguiente.
 await nextTab('retiros');await open(aviso.id);await api(`/orders/${aviso.id}/notified`,'POST',{notified:false});await page.waitForSelector('.ws-sheet',{hidden:true});assert.equal(await page.$('.ws-queue-row.selected'),null)
 // El guardado y una sincronización posterior fallida tienen un único resultado.
 await nextTab('avisar');await open(aviso.id);await clearToasts();failBootstrap=true
 const failedRefresh=page.waitForResponse(response=>response.url().endsWith('/api/bootstrap')&&response.status()===503)
 await click('Avisar al cliente');await click('Registrar aviso','[role=dialog]');await page.waitForSelector('[role=dialog]',{hidden:true});await waitOrder(aviso.id,o=>o.notified)
 await failedRefresh
 assert.equal(await page.$$eval('[data-notification=error]',nodes=>nodes.length),0)
 assert.equal(await page.$$eval('[data-notification=success]',nodes=>nodes.filter(node=>node.textContent.includes('Aviso registrado.')).length),1)
 failBootstrap=false
 // Asignación diferida, cancelación y guardado.
 const assigning=await create('Asignación regresión');await goto('taller');await nextTab('all');await open(assigning.id);await click('Acciones');await click('Asignar técnico','[role=menu]');await page.select('[role=dialog] select',tech.id)
 assert.equal((await api(`/orders/${assigning.id}`)).order.assignedTo,null)
 await click('Cancelar','[role=dialog]');await click('Acciones');await click('Asignar técnico','[role=menu]');await page.select('[role=dialog] select',tech.id);await click('Guardar','[role=dialog]');await page.waitForSelector('[role=dialog]',{hidden:true});await waitOrder(assigning.id,o=>o.assignedTo===tech.id)
 // Los cuatro retiros conservan su constancia, incluso después de ocultar la ficha.
 for(const receipt of ['Con orden','Sin orden'])for(const who of ['El cliente','Otra persona']){
  const order=await ready(`Retiro ${receipt} ${who}`);await api(`/orders/${order.id}/notified`,'POST',{notified:true});await goto('recepcion');await nextTab('retiros');await open(order.id);await click('Registrar retiro');await click(receipt,'[role=dialog]');await click(who,'[role=dialog]')
  if(who==='Otra persona'){const inputs=await page.$$('[role=dialog] input[type=text]');await inputs[0].type('Persona de prueba');await inputs[1].type('22.333.444');assert.equal(await inputs[1].evaluate(node=>node.value),'22.333.444')}
  await click('Confirmar entrega','[role=dialog]');await page.waitForFunction(()=>document.querySelector('[role=dialog]')?.textContent.includes('Retirado por'));assert.equal(await page.$('.ws-sheet'),null)
  const saved=(await api(`/orders/${order.id}`)).order;assert.equal(saved.status,'entregado');if(who==='Otra persona')assert.equal(saved.pickupDni,'22333444')
  assert.equal(await page.$$eval('[role=dialog] button',nodes=>nodes.some(node=>node.textContent.includes('Imprimir constancia'))),receipt==='Sin orden')
  await click('Cerrar','[role=dialog]');await page.waitForSelector('[role=dialog]',{hidden:true})
 }
 // Caché por filtros; carga inicial y error nunca se presentan como cero equipos.
 slow=true;await page.click('a[href="/terminados"]');await page.waitForFunction(()=>document.querySelector('.sc-content h1')?.textContent==='Terminados');assert.ok(!(await page.$eval('.sc-content',node=>node.textContent)).includes('0 equipo(s)'));await page.waitForSelector('table')
 await page.click('a[href="/clientes"]');await page.waitForSelector('table');await page.click('a[href="/terminados"]');await page.waitForFunction(()=>document.querySelector('.sc-content h1')?.textContent==='Terminados');assert.ok(await page.$('table'),'Volver a la misma consulta conserva los datos mientras revalida')
 await page.waitForSelector('[aria-busy=false]');fail=true
 await page.type('input[placeholder^="Buscar por"]','fallo deliberado');await page.waitForFunction(()=>document.querySelector('[role=alert]')?.textContent.includes('Consulta de prueba'));assert.ok(!(await page.$eval('.sc-content',node=>node.textContent)).includes('0 equipo(s)'));fail=false;await click('Reintentar');await page.waitForSelector('[aria-busy=false]')
 await goto('resumen');await page.waitForFunction(()=>location.pathname==='/recepcion');assert.equal(await page.$('a[href="/resumen"]'),null)
 await goto('configuracion?tab=impresoras');await page.waitForSelector('#settings-impresoras[aria-current=page]');assert.ok(page.url().includes('/ajustes?tab=impresoras'))
 await goto('ajustes');for(const tab of ['cuenta','general','impresoras','opciones','catalogo','terminos','externos'])assert.ok(await page.$(`#settings-${tab}`))
 await goto(`clientes/${customer.id}`);assert.ok(!(await page.$eval('.sc-content',node=>node.textContent)).includes('(0)'));await page.waitForSelector('.sc-content li button');assert.ok((await page.$eval('.sc-content',node=>node.textContent)).includes('12.456.789'))
 assert.deepEqual(errors,[])
 await goto('ajustes');await page.waitForSelector('.sc-account')
 fs.mkdirSync('test-results/integracion-ui',{recursive:true});await page.screenshot({path:path.resolve('test-results/integracion-ui/ajustes-unificados.png'),fullPage:true})
 console.log('✓ Regresiones reales: sin selección automática, aviso único, cambios externos, asignación diferida, cuatro retiros, DNI, caché, carga/error y Ajustes unificados.')
}catch(error){fs.mkdirSync('test-results/integracion-ui',{recursive:true});await page.screenshot({path:path.resolve('test-results/integracion-ui/pulido-fallo.png'),fullPage:true}).catch(()=>{});throw error}finally{await browser.close()}
