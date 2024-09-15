#!/usr/bin/env node

import esbuild from 'esbuild';

Promise.all([
    esbuild.build({
        entryPoints: ['source/Legacy.ts'],
        bundle: true,
        target: 'es2020',
        format: 'iife',
        outfile: 'dist/squire-raw.js',
    }),
]).catch(() => process.exit(1));
