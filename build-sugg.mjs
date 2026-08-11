import * as esbuild from 'esbuild'
const S = process.env.S
await esbuild.build({
  entryPoints: [`${S}/sugg/entry.tsx`], bundle: true, outfile: `${S}/sugg/bundle.js`,
  jsx: 'automatic', loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: { '@/lib/supabase/client': `${S}/sugg/stub.ts`, '@': '/home/user/carta-canta' },
})
console.log('bundle ok')
