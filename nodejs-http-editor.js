var http = require("http");
var fs = require("fs");
var server = http.createServer(servFunc);
var PORT = 8888;
var qs = require('querystring');

const CREATE_DIR_PREFIX = "_CREATE_DIR_";
const CREATE_FILE_PREFIX = "_CREATE_FILE_";
const SAVE_FILE_PREFIX = "_SAVE_FILE_";

if(process.argv.length==3) {
	try {
		PORT = parseInt(process.argv[2]);
	} catch(e) {
		console.log(`Unable to set PORT to ${process.argv[2]}`);
	}
}

function parseBody(req, callback) {
	var body = '';
	req.on('data', (data) => body += data);
	req.on('end', () => callback(qs.parse(body)))
}

function servFunc(req, res) {
	var url = req.url;
	if (url != '/favicon.ico') {
		try {
			if(req.method=="POST") {
				processMkdirTouchAndSave(req,res,url);
			} else {
				if (url.indexOf("_FILE_") > -1) {
					viewContentOfFile(url, res);
				} else {
					listFilesInDir(url, res);
				}
			}		
		} catch(e) {
			console.log(e);
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end("Error occured: "+JSON.stringify(e)+"<br><a href='/'>Goto Home</a>");
		}
	} else {
		res.end("");
	}
}

function processMkdirTouchAndSave(req,res,url) {
	parseBody (req, function (fields) {
		console.log(JSON.stringify(fields));
		try {
			if(fields.dir!=undefined && fields.dir.indexOf(CREATE_DIR_PREFIX)>-1) {
				url = cleanUpUrl(url);
				var dirToCreate = fields.dir.replace(CREATE_DIR_PREFIX,"");
				console.log(__dirname+url+dirToCreate);
				fs.mkdirSync(__dirname+url+dirToCreate);
				listFilesInDir(url, res);
			} else if(fields.fName!=undefined && fields.fName.indexOf(CREATE_FILE_PREFIX)>-1) {
				url = cleanUpUrl(url);
				var fileToCreate = fields.fName.replace(CREATE_FILE_PREFIX,"");
				console.log(__dirname+url+fileToCreate);
				fs.writeFileSync(__dirname+url+fileToCreate,"");
				listFilesInDir(url, res);
			} else if(fields.fPath!=undefined && fields.fPath.indexOf(SAVE_FILE_PREFIX)>-1 && fields.content!=undefined) {
				if (url.indexOf("_FILE_") > -1) {
					url = url.replace("_FILE_","");
					url = url.replace(".","").trim();
				}
				if(url[url.length-1]=="/") {
					url = url.substring(0,url.length-1);
				}
				var fileToSave = fields.fPath.replace(SAVE_FILE_PREFIX,"");
				if(fileToSave[fileToSave.length-1]=="/") {
					fileToSave = fileToSave.substring(0,fileToSave.length-1);
				}
				console.log("Saving to..."+__dirname+"/"+fileToSave);
				console.log(`content to be written ${fields.content}`);
				fs.writeFileSync(__dirname+"/"+fileToSave,String(fields.content).replace("\r\n","\n").replace("\n","\r\n"));
				var urlSplit = url.split("/");
				url = url.replace("/"+urlSplit[urlSplit.length-1],"");
				console.log("will redirect to "+url);
				listFilesInDir(url, res, url);
			}
		} catch(e) {
			console.log(e);
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end("Error occured: "+JSON.stringify(e)+"<br><a href='/'>Goto Home</a>");
		}
	});
}

function viewContentOfFile(url, res) {
	url = url.replace("_FILE_", "");
	url = cleanUpUrl(url);
	if (url[0] == ".") {
		url = url.substring(1);
	}
	if (url[0] == "/") {
		url = url.substring(1);
	}
	if (url[url.length - 1] == "/") {
		url = url.substring(0, url.length - 1);
	}
	console.log("Reading " + url);
	var data = fs.readFileSync(url);
	var html = `<button onclick='saveFile(\"${url}\")'>Save</button><br><textarea>${data}</textarea>`;
	html = wrapHtmlInTable(html);
	html += getEditorStyle()+getFileSavingScript();
	res.writeHead(200, { 'Content-Type': 'text/html' });
	res.end(html);
}

function listFilesInDir(url, res,redirectAfterSave) {
	url = cleanUpUrl(url);
	console.log(url);
	var files = fs.readdirSync("." + url);
	var html = "<button onclick='makeDir(\"" + url + "\")'>Create Directory</button><button onclick='makeFile(\"" + url + "\")'>Create File</button><br><ul>";
	for (var i in files) {
		var filePath = url + files[i];
		var fsStat = fs.statSync("." + filePath);
		var clss = "file";
		var aStrt = "<a>";
		var aEnd = "</a>";
		if (fsStat.isDirectory()) {
			aStrt = "<a href='." + filePath + "'>"; clss = "dir";
		} else {
			aStrt = "<a href='_FILE_" + filePath + "'>";
		}
		html += "<li class='" + clss + "'>" + aStrt + files[i] + aEnd + "</li>";
	}
	html += "</ul>";
	html = wrapHtmlInTable(html);
	html += getStyle() + getFileListingScript();
	if(redirectAfterSave!=undefined) {
		if(redirectAfterSave=="REDIRECT_TO_HOME") {
			html+="<script>window.location.href='';</script>";
		} else {
			html+="<script>alert('Saved..');window.location.href='"+url+"';</script>";
		}
	}
	res.writeHead(200, { 'Content-Type': 'text/html' });
	res.end(html);
}

function cleanUpUrl(url) {
	if (url != "/") {
		while (url.indexOf("/") == 0) {
			url = url.substring(1);
		}
		if (url == "") {
			url = "/";
		} else {
			while (url[url.length - 1] == "/") {
				url = url.substring(0, url.length - 1);
			}
		}
	}
	var urlSplit = url.split("/");
	var curr = "";
	var prev = null;
	var newUrl = "";
	for(var i=0;i<urlSplit.length;i++) {
		curr = urlSplit[i].trim();
		if(curr=="") {
			continue;
		}
		if(prev!=null && curr==prev) {
			continue;
		}
		prev = curr;
		if(newUrl=="") {
			newUrl = curr;
		} else {
			newUrl += "/"+curr;
		}
	}
	url = newUrl;
	if (url[0] != "/") {
		url = "/" + url;
	}
	if (url[url.length - 1] != "/") {
		url = url + "/";
	}
	return url;
}

function wrapHtmlInTable(html) {
	var ret = `<table><tr><td>${html}</td></tr></table>`;
	return ret;
}

function getEditorStyle() {
	return `
	<style>
	textarea{
		background-color:black;
		color:white;
		height:400px;
		width:400px;
	}
	table{
		margin-left:auto;
		margin-right:auto;
		width:250px;
	}
	button{
		border:none;
		background-color:blue;
		width:100%;
		color:white;
	}
	</style>
	`;
}

function getFileSavingScript() {
	return `
	<script>
	    function $(selector) {
			return document.querySelector(selector);
		}
		function _(tag,attribs,parent) {
			var o = document.createElement(tag);
			for(var k in attribs) {
				o.setAttribute(k,attribs[k]);
			}
			if(parent!=undefined) {
				parent.appendChild(o);
			}
			return o;
		}
		function saveFile(fPath) {
			if(fPath && fPath.trim()!="") {
				var form = _("form",{"method":"POST","action":fPath},document.body);
				var txt1 = _("input",{"type":"text","value":"${SAVE_FILE_PREFIX}"+fPath,"name":"fPath"},form);
				var txt2 = _("input",{"type":"text","value":$("textarea").value,"name":"content"},form);
				form.submit();
			}
		}
	</script>
		`;
	}

function getFileListingScript() {
	return `
	<script>
	    function $(selector) {
			return document.querySelector(selector);
		}
		function _(tag,attribs,parent) {
			var o = document.createElement(tag);
			for(var k in attribs) {
				o.setAttribute(k,attribs[k]);
			}
			if(parent!=undefined) {
				parent.appendChild(o);
			}
			return o;
		}
        function makeDir(path) {
            var dir = prompt("Enter dir Name");
			if(dir && dir.trim()!="") {
				var form = _("form",{"method":"POST","action":path},document.body);
				var txt1 = _("input",{"type":"text","value":"${CREATE_DIR_PREFIX}"+dir,"name":"dir"},form);
				form.submit();
			}
		}
		function makeFile(path) {
            var fName = prompt("Enter file Name");
			if(fName && fName.trim()!="") {
				var form = _("form",{"method":"POST","action":path},document.body);
				var txt1 = _("input",{"type":"text","value":"${CREATE_FILE_PREFIX}"+fName,"name":"fName"},form);
				form.submit();
			}
		}
	</script>
	`;
}

function getStyle() {
	return `
<style>
.dir{
    background-color:yellow;
}
li{
	border-radius:10px;
	margin-bottom:3px;
	padding:3px;
	text-align:center;
}
table{
	margin-left:auto;
	margin-right:auto;
	width:250px;
}
button{
	border:none;
	background-color:blue;
	margin-left:3px;
	padding:3px;
	border-radius:5px;
	width:45%;
	color:white;
}
</style>
        `;
}

server.listen(PORT, () => { console.log(`listening on ${PORT}`); });
