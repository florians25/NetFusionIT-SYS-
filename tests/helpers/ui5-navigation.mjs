// Follow the same native overflow menu on desktop and phone.
export async function selectTicketTab(page,name){
 await page.waitForLoadState('networkidle');await page.waitForFunction(()=>!document.querySelector('.sapMNavItemFading,.sapMNavItemTransparent,.sapMNavItemSlideCenterToLeft,.sapMNavItemSlideRightToCenter,[aria-busy="true"]'));const tabs=page.locator('[id$="--ticketSections"]');await tabs.waitFor();const tab=tabs.getByRole('tab',{name,exact:true});if(await tab.isVisible())await tab.click();else{await tabs.getByRole('button',{name:'Mehr',exact:true}).click();await page.getByRole('menuitem',{name,exact:true}).click();}
}
