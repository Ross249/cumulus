#version 300 es
precision highp float;
precision highp sampler3D;
uniform vec4 u[32];
uniform sampler3D n;
out vec4 outColor;
float sampleNoise(vec3 p) {
  return textureLod(n,p,0.).r;
}
float noise(vec3 p) {
  vec3 i=floor(p);
  vec3 f=fract(p);
  f=f*f*(vec3(3.)-2.*f);
  return sampleNoise((i+f+vec3(.5))/8.);
}
float smoothUnion(float a,float b,float k) {
  float h=max(k-abs(a-b),0.)/k;
  return min(a,b)-h*h*k*.25;
}
float densityAt(vec3 w) {
  if(any(lessThan(w,u[6].xyz))||any(lessThan(u[7].xyz,w))) {
    return 0.;
  }
  vec3 p=w/u[5].xyz;
  if(p.y<u[16].x) {
    return 0.;
  }
  float d=100.;
  for(int i=0;i<12;i++) {
    if(float(i)>=u[18].w) {
      break;
    }
    vec4 l=u[20+i];
    d=smoothUnion(d,length(p-l.xyz)-l.w,u[16].z);
  }
  if(d>u[7].w+u[15].z*.5+.02) {
    return 0.;
  }
  vec3 q=p*u[14].w+u[14].xyz*u[0].z*.025+vec3(u[0].w*.173);
  float n=noise(q*4.);
  float octave=noise(q*8.+vec3(.37));
  float c=noise(q*16.+vec3(.71));
  float b=noise(q*32.+vec3(.13));
  float f=-d+u[7].w+(n-.5)*u[15].z;
  f-=u[15].x*(1.-.65*n-.35*octave)+u[15].y*c+u[15].w*b;
  return smoothstep(0.,u[6].w,f)*u[5].w*smoothstep(u[16].x,u[16].x+u[16].y,p.y);
}
float lightDepth(vec3 p) {
  float g=1.65;
  float s=u[17].y*(g-1.)/(pow(g,u[17].x)-1.);
  float t=0.;
  float v=0.;
  for(int j=0;j<12;j++) {
    if(float(j)>=u[17].x) {
      break;
    }
    v+=densityAt(p+u[8].xyz*(t+s*.5))*s;
    t+=s;
    s*=g;
  }
  return v*u[10].w;
}
float phase(float mu,float g) {
  return(1.-g*g)/pow(max(1.+g*g-2.*g*mu,.01),1.5);
}
vec3 toneMap(vec3 cl) {
  vec3 c=cl*u[3].w;
  return clamp((c*(2.51*c+vec3(.03)))/(c*(2.43*c+vec3(.59))+vec3(.14)),vec3(0.),vec3(1.));
}
vec3 toSRGB(vec3 c) {
  return mix(12.92*c,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-vec3(.055),step(vec3(.0031308),c));
}
vec4 cloud(vec2 px) {
  vec2 uv=(px*2.-u[0].xy)/u[0].y-u[18].xy;
  vec3 ro=u[1].xyz;
  vec3 rd=normalize(u[4].xyz+(uv.x*u[2].xyz+uv.y*u[3].xyz)*u[1].w);
  vec3 inv=vec3(1.)/(mix(vec3(-1.),vec3(1.),step(vec3(0.),rd))*max(abs(rd),vec3(.00001)));
  vec3 ta=(u[6].xyz-ro)*inv;
  vec3 tb=(u[7].xyz-ro)*inv;
  vec3 lo=min(ta,tb);
  vec3 hi=max(ta,tb);
  float a=max(max(lo.x,max(lo.y,lo.z)),0.);
  float b=min(hi.x,min(hi.y,hi.z));
  vec3 c=vec3(0.);
  float r=1.;
  float mu=dot(rd,u[8].xyz);
  float h=.65+.35*phase(mu,u[16].w);
  float j=u[17].w*pow(max(mu,0.),10.);
  if(b>a) {
    float s=(b-a)/u[4].w;
    float k=fract(52.9829189*fract(dot(px,vec2(.06711056,.00583715))));
    float t=a+s*mix(.5,k,u[18].z);
    for(int i=0;i<192;i++) {
      if(float(i)>=u[4].w||t>b||r<.006) {
        break;
      }
      vec3 p=ro+rd*t;
      float d=densityAt(p);
      if(d>.001) {
        float e=lightDepth(p)*u[11].w;
        float f=exp(-e);
        float g=u[13].w*exp(-e*.18);
        float m=1.-u[17].z*exp(-d*1.5);
        float n=smoothstep(u[16].x,1.8,p.y/u[5].y);
        vec3 am=mix(u[11].xyz,vec3(1.),n*u[19].z)*u[9].w;
        vec3 li=u[9].xyz*u[8].w*((f+g)*h*m+j*f);
        float al=1.-exp(-d*u[10].w*s);
        c+=r*al*u[10].xyz*(am+li);
        r*=1.-al;
      }
      t+=s;
    }
  }
  float al=(1.-r)*u[2].w;
  vec3 co=toneMap(c/max(1.-r,.0001));
  vec3 cl=toSRGB(co);
  if(u[12].w>.5) {
    return vec4(cl*al,al);
  }
  float sm=smoothstep(-.4,u[19].x,rd.y);
  vec3 sk=mix(u[13].xyz,u[12].xyz,sm);
  sk+=u[9].xyz*u[19].y*pow(max(mu,0.),32.);
  return vec4(toSRGB(co*al+sk*(1.-al)),1.);
}
void main() {
  outColor=cloud(gl_FragCoord.xy);
}
