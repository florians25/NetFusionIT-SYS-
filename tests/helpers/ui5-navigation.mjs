// Follow the same native overflow menu on desktop and phone.
export async function selectTicketTab(page,name){
 await page.waitForLoadState('networkidle');await page.waitForFunction(()=>!document.querySelector('.sapMNavItemFading,.sapMNavItemTransparent,.sapMNavItemSlideCenterToLeft,.sapMNavItemSlideRightToCenter,[aria-busy="true"]'));const tabs=page.locator('[id$="--ticketSections"]');await tabs.waitFor();const tab=tabs.getByRole('tab',{name,exact:true});if(await tab.isVisible())await tab.click();else{await tabs.getByRole('button',{name:'Mehr',exact:true}).click();await page.getByRole('menuitem',{name,exact:true}).click();}
}

// Fixtures without company data explicitly postpone the real first-login wizard.
export async function enterAppCenter(page){
 const title=page.locator('[id$="--appCenterTitle"]');
 const later=page.getByRole('button',{name:'Später einrichten',exact:true});
 await Promise.race([title.waitFor(),later.waitFor()]);
 if(await later.isVisible())await later.click();
 await title.waitFor();
}
