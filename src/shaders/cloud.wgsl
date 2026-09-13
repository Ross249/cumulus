@group(0) @binding(0) var<uniform> u: array<vec4f, 32>;
@group(0) @binding(1) var n: texture_3d<f32>;
@group(0) @binding(2) var s: sampler;
fn sampleNoise(p: vec3f) -> f32 {
  return textureSampleLevel(n,s,p,0.).r;
}
fn noise(p: vec3f) -> f32 {
  var i: vec3f=floor(p);
  var f: vec3f=fract(p);
  f=f*f*(vec3f(3.)-2.*f);
  return sampleNoise((i+f+vec3f(.5))/8.);
}
fn smoothUnion(a: f32, b: f32, k: f32) -> f32 {
  var h: f32=max(k-abs(a-b),0.)/k;
  return min(a,b)-h*h*k*.25;
}
fn densityAt(w: vec3f) -> f32 {
  if(any((w<u[6].xyz))||any((u[7].xyz<w))) {
    return 0.;
  }
  var p: vec3f=w/u[5].xyz;
  if(p.y<u[16].x) {
    return 0.;
  }
  var d: f32=100.;
  for(var i: i32=0;i<12;i++) {
    if(f32(i)>=u[18].w) {
      break;
    }
    var l: vec4f=u[20+i];
    d=smoothUnion(d,length(p-l.xyz)-l.w,u[16].z);
  }
  if(d>u[7].w+u[15].z*.5+.02) {
    return 0.;
  }
  var q: vec3f=p*u[14].w+u[14].xyz*u[0].z*.025+vec3f(u[0].w*.173);
  var n: f32=noise(q*4.);
  var octave: f32=noise(q*8.+vec3f(.37));
  var c: f32=noise(q*16.+vec3f(.71));
  var b: f32=noise(q*32.+vec3f(.13));
  var f: f32=-d+u[7].w+(n-.5)*u[15].z;
  f-=u[15].x*(1.-.65*n-.35*octave)+u[15].y*c+u[15].w*b;
  return smoothstep(0.,u[6].w,f)*u[5].w*smoothstep(u[16].x,u[16].x+u[16].y,p.y);
}
fn lightDepth(p: vec3f) -> f32 {
  var g: f32=1.65;
  var s: f32=u[17].y*(g-1.)/(pow(g,u[17].x)-1.);
  var t: f32=0.;
  var v: f32=0.;
  for(var j: i32=0;j<12;j++) {
    if(f32(j)>=u[17].x) {
      break;
    }
    v+=densityAt(p+u[8].xyz*(t+s*.5))*s;
    t+=s;
    s*=g;
  }
  return v*u[10].w;
}
fn phase(mu: f32, g: f32) -> f32 {
  return(1.-g*g)/pow(max(1.+g*g-2.*g*mu,.01),1.5);
}
fn toneMap(cl: vec3f) -> vec3f {
  var c: vec3f=cl*u[3].w;
  return clamp((c*(2.51*c+vec3f(.03)))/(c*(2.43*c+vec3f(.59))+vec3f(.14)),vec3f(0.),vec3f(1.));
}
fn toSRGB(c: vec3f) -> vec3f {
  return mix(12.92*c,1.055*pow(max(c,vec3f(0.)),vec3f(1./2.4))-vec3f(.055),step(vec3f(.0031308),c));
}
fn cloud(px: vec2f) -> vec4f {
  var uv: vec2f=(px*2.-u[0].xy)/u[0].y-u[18].xy;
  var ro: vec3f=u[1].xyz;
  var rd: vec3f=normalize(u[4].xyz+(uv.x*u[2].xyz+uv.y*u[3].xyz)*u[1].w);
  var inv: vec3f=vec3f(1.)/(mix(vec3f(-1.),vec3f(1.),step(vec3f(0.),rd))*max(abs(rd),vec3f(.00001)));
  var ta: vec3f=(u[6].xyz-ro)*inv;
  var tb: vec3f=(u[7].xyz-ro)*inv;
  var lo: vec3f=min(ta,tb);
  var hi: vec3f=max(ta,tb);
  var a: f32=max(max(lo.x,max(lo.y,lo.z)),0.);
  var b: f32=min(hi.x,min(hi.y,hi.z));
  var c: vec3f=vec3f(0.);
  var r: f32=1.;
  var mu: f32=dot(rd,u[8].xyz);
  var h: f32=.65+.35*phase(mu,u[16].w);
  var j: f32=u[17].w*pow(max(mu,0.),10.);
  if(b>a) {
    var s: f32=(b-a)/u[4].w;
    var k: f32=fract(52.9829189*fract(dot(px,vec2f(.06711056,.00583715))));
    var t: f32=a+s*mix(.5,k,u[18].z);
    for(var i: i32=0;i<192;i++) {
      if(f32(i)>=u[4].w||t>b||r<.006) {
        break;
      }
      var p: vec3f=ro+rd*t;
      var d: f32=densityAt(p);
      if(d>.001) {
        var e: f32=lightDepth(p)*u[11].w;
        var f: f32=exp(-e);
        var g: f32=u[13].w*exp(-e*.18);
        var m: f32=1.-u[17].z*exp(-d*1.5);
        var n: f32=smoothstep(u[16].x,1.8,p.y/u[5].y);
        var am: vec3f=mix(u[11].xyz,vec3f(1.),n*u[19].z)*u[9].w;
        var li: vec3f=u[9].xyz*u[8].w*((f+g)*h*m+j*f);
        var al: f32=1.-exp(-d*u[10].w*s);
        c+=r*al*u[10].xyz*(am+li);
        r*=1.-al;
      }
      t+=s;
    }
  }
  var al: f32=(1.-r)*u[2].w;
  var co: vec3f=toneMap(c/max(1.-r,.0001));
  var cl: vec3f=toSRGB(co);
  if(u[12].w>.5) {
    return vec4f(cl*al,al);
  }
  var sm: f32=smoothstep(-.4,u[19].x,rd.y);
  var sk: vec3f=mix(u[13].xyz,u[12].xyz,sm);
  sk+=u[9].xyz*u[19].y*pow(max(mu,0.),32.);
  return vec4f(toSRGB(co*al+sk*(1.-al)),1.);
}

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  return vec4f(vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2. - vec2f(1.), 0., 1.);
}
@fragment fn fs(@builtin(position) p: vec4f) -> @location(0) vec4f {
  return cloud(vec2f(p.x, u[0].y - p.y));
}
