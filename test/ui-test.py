import asyncio, pathlib, json
from playwright.async_api import async_playwright
base = pathlib.Path(__file__).resolve().parent.parent / 'renderer'
MOCK = r"""
window.__calls=[]; window.__copied=[];
window.nasaq={
  ps: async (op,p)=>{ window.__calls.push([op,p]);
    if(op==='ping') return {ok:true,hasDoc:true,name:'thumb.psd',W:1920,H:1080};
    if(op==='social') return {ok:true,placed:p.picked.length,nameAdded:!!p.nameText,W:1350,H:1080,warnings:[]};
    if(op==='text') return {ok:true,count:1,warnings:[]};
  },
  copy: async (t)=>{window.__copied.push(t.length);return true;},
  setOnTop: async()=>true,
  assetsDir: async()=>'C:/NASAQ/renderer/assets'
};
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':420,'height':820})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(MOCK)
        await pg.goto('file://'+str(base/'index.html')); await pg.wait_for_timeout(2200)
        print('chip:', await pg.inner_text('#psChip'))
        await pg.screenshot(path='/home/claude/work/app_home.png')
        # social
        await pg.click('[data-open=socialView]'); await pg.wait_for_timeout(500)
        await pg.click('.social-row[data-social=youtube]'); await pg.fill('#socialName','@nasaq')
        await pg.select_option('#socialAlign','right'); await pg.select_option('#socialPos','top')
        await pg.click('#socialAddBtn'); await pg.wait_for_timeout(900)
        call=[c for c in await pg.evaluate('window.__calls') if c[0]=='social'][0][1]
        print('social picked:', call['picked'], '| align', call['hAlign'], call['vPos'], '| name', call['nameText'], '| assets', call['assets'])
        print('status:', await pg.inner_text('#status'))
        # text studio: enable only size+stroke
        await pg.click('#socialView [data-home]'); await pg.wait_for_timeout(400)
        await pg.click('[data-open=textView]'); await pg.wait_for_timeout(500)
        await pg.click('#txtApplyBtn'); await pg.wait_for_timeout(700)
        print('nothing enabled →', await pg.inner_text('#status'))
        await pg.click('[data-toggle=size]'); await pg.click('[data-toggle=stroke]'); await pg.fill('#txtSize','96')
        await pg.select_option('#txtTarget','new'); await pg.fill('#txtContent','عنوان')
        await pg.screenshot(path='/home/claude/work/app_text.png')
        await pg.click('#txtApplyBtn'); await pg.wait_for_timeout(900)
        t=[c for c in await pg.evaluate('window.__calls') if c[0]=='text'][0][1]
        print('text cfg keys:', sorted(t['cfg'].keys()), '| mode', t['mode'])
        # style library
        await pg.fill('#txtStyleName','عنوان ثامبنيل'); await pg.click('#txtSaveBtn'); await pg.wait_for_timeout(200)
        print('saved styles:', await pg.eval_on_selector_all('.style-row .load','e=>e.map(x=>x.textContent)'))
        # prompts + copy
        await pg.click('#textView [data-home]'); await pg.wait_for_timeout(400)
        await pg.click('[data-open=surrealView]'); await pg.wait_for_timeout(500)
        await pg.click('#thumbPromptBtn'); await pg.wait_for_timeout(1200)
        print('copied lengths:', await pg.evaluate('window.__copied'))
        print('errors:', errs); await b.close()
asyncio.run(main())
