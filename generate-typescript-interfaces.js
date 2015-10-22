var cp = require('child_process');

var attach = require('./index');


var proc = cp.spawn('nvim', ['-u', 'NONE', '-N', '--embed'], {
  cwd: __dirname
});

var typeMap = {
  'String': 'string',
  'Integer': 'number',
  'Boolean': 'boolean',
  'Array': 'Array<any>',
  'Dictionary': 'Object',
};

function convertType(type) {
  if (typeMap[type]) return typeMap[type];
  var genericMatch = /Of\((\w+)[^)]*\)/.exec(type);
  if (genericMatch) {
    var t = convertType(genericMatch[1]);
    if (/^Array/.test(type))
      return 'Array<' + t + '>';
    else
      return '{ [key: string]: ' + t + '; }';
  }
  return type;
}

function metadataToSignature(method) {
  var params = [];
  for (var i = 0; i < method.parameters.length; i++) {
    var type;
    if (i < method.parameterTypes.length) {
      type = convertType(method.parameterTypes[i]);
      params.push(method.parameters[i] + ': ' + type);
    } else {
      return '    ' + method.name + '(' + params.join(', ') + '): Promise<' + convertType(method.returnType) + '>;\n';
    }
  }
}

attach(proc.stdin, proc.stdout, function(err, nvim) {
  var interfaces = {
    Nvim: nvim.constructor,
    Buffer: nvim.Buffer,
    Window: nvim.Window,
    Tabpage: nvim.Tabpage,
  };

  // use a similar reference path to other definitely typed declarations
  process.stdout.write('declare module "neovim-client" {\n');
  process.stdout.write('  export default attach;\n');
  process.stdout.write('  function attach(writer: NodeJS.WritableStream, reader: NodeJS.ReadableStream, cb: (err: Error, nvim: Nvim) => void);\n\n');

  Object.keys(interfaces).forEach(function(key) {
    process.stdout.write('  interface ' + key + ' {\n');
    Object.keys(interfaces[key].prototype).forEach(function(method) {
      method = interfaces[key].prototype[method];
      if (method.metadata) {
        process.stdout.write(metadataToSignature(method.metadata));
      }
    })
    process.stdout.write('  }\n');
  });

  process.stdout.write('}\n');
  proc.stdin.end();
});
