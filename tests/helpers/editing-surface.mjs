// Native UI5 work pages replace large modal editors; short actions stay dialogs.
export function editingSurface(page,options={}){let surface=page.locator('.sapMDialog[role="dialog"]:visible, [id$="--workspacePage"]:visible');if(options.name!==undefined)surface=surface.filter({has:page.getByRole('heading',{name:options.name,exact:options.exact})});return surface;}
