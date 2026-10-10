import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const ORIGIN = process.env.M1_TEST_ORIGIN ?? "http://127.0.0.1:4173";

test("M6 Chromium: forgotten account JWT never silently exposes Local beta", {timeout:60000}, async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext();
    // The one-time fixture survives a reload without re-inserting the pointer.
    await context.addInitScript(()=>{
      if(!sessionStorage.getItem("m6-fixture-loaded")){
        localStorage.setItem("chunkdiary.activeWorkspaceAccount.v1",
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        sessionStorage.setItem("m6-fixture-loaded","yes");
      }
    });
    const page=await context.newPage();
    await page.goto(ORIGIN+"/");
    await page.getByRole("heading",{name:"Cần xác minh lại tài khoản"}).waitFor();
    const names=await page.evaluate(async()=> (await indexedDB.databases()).map(x=>x.name));
    assert.ok(!names.includes("LanguageChunkDiaryDB"),"Beta must not seed while owner is unverified");
    assert.ok(!names.some(x=>x?.includes("account-aaaaaaaa")),"Do not open foreign owner DB");
    page.on("dialog",dialog=>dialog.accept());
    await page.getByRole("button",{name:"Chọn chế độ Local beta"}).click();
    await page.getByRole("button",{name:"Trang chủ"}).first().waitFor();
    const pointer=await page.evaluate(()=>
      localStorage.getItem("chunkdiary.activeWorkspaceAccount.v1"));
    assert.equal(pointer,null,"explicit Local selection should clear account preference");
    const dbs=await page.evaluate(async()=> (await indexedDB.databases()).map(x=>x.name));
    assert.ok(dbs.includes("LanguageChunkDiaryDB"),"explicit Local selection opens beta");
    await context.close();
  }finally{await browser.close();}
});
