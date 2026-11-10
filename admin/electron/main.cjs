const { app, BrowserWindow, protocol, net, session, dialog, Menu } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
protocol.registerSchemesAsPrivileged([{scheme:'quanying', privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
app.enableSandbox();
if(!app.isPackaged && process.env.QUANYING_TEST_PROFILE) app.setPath('userData',process.env.QUANYING_TEST_PROFILE);
let window;
function createWindow() {
  window = new BrowserWindow({width:1320,height:900,minWidth:960,minHeight:680,title:'犬影村管理平台',backgroundColor:'#f7f8f5',show:false,
    titleBarStyle:'hidden',
    ...(process.platform==='darwin' ? {trafficLightPosition:{x:20,y:19}} : {titleBarOverlay:{color:'#f7f8f5',symbolColor:'#34473f',height:52}}),
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  window.once('ready-to-show',()=>window.show());
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('quanying://app/'))event.preventDefault();});
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  window.webContents.on('did-fail-load',(_event,code,description)=>{if(code!==-3)dialog.showErrorBox('页面加载失败',description);});
  window.loadURL('quanying://app/index.html');
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
  app.whenReady().then(()=>{
    // Keep native editing shortcuts on macOS; remove the default in-window menu on Windows.
    Menu.setApplicationMenu(process.platform==='darwin' ? Menu.buildFromTemplate([{role:'appMenu'},{role:'editMenu'},{role:'windowMenu'}]) : null);
    const root=path.join(app.getAppPath(),'dist');
    protocol.handle('quanying',request=>{
      const url=new URL(request.url);
      if(url.host!=='app')return new Response('Forbidden',{status:403});
      let file;
      try{file=path.resolve(root,'.'+decodeURIComponent(url.pathname));}catch{return new Response('Bad request',{status:400});}
      if(!file.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
      return net.fetch(pathToFileURL(file).toString());
    });
    session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    session.defaultSession.setPermissionCheckHandler(()=>false);
    createWindow();
    app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
  });
  app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
}
