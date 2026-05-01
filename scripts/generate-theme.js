#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const env = args[0] || 'production';

const isDev = env === 'development';
const envFile = isDev ? 'environment.development.ts' : 'environment.ts';
const themeFile = isDev ? 'theme.development.ts' : 'theme.ts';

function generateOptimalPalette(baseColor) {
    function hexToHsl(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) {
            throw new Error('Color hexadecimal inválido');
        }

        let r = parseInt(result[1], 16) / 255;
        let g = parseInt(result[2], 16) / 255;
        let b = parseInt(result[3], 16) / 255;

        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return [h * 360, s * 100, l * 100];
    }

    function hslToHex(h, s, l) {
        h = h % 360;
        if (h < 0) h += 360;

        s = Math.max(0, Math.min(100, s)) / 100;
        l = Math.max(0, Math.min(100, l)) / 100;

        const a = s * Math.min(l, 1 - l);
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    function mix(color1, color2, weight) {
        const hex = (c) => {
            c = c.replace('#', '');
            return [c.substr(0, 2), c.substr(2, 2), c.substr(4, 2)]
                .map(x => parseInt(x, 16));
        };

        const [r1, g1, b1] = hex(color1);
        const [r2, g2, b2] = hex(color2);

        const r = Math.round(r1 * (1 - weight) + r2 * weight);
        const g = Math.round(g1 * (1 - weight) + g2 * weight);
        const b = Math.round(b1 * (1 - weight) + b2 * weight);

        return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
    }

    const [h, s, l] = hexToHsl(baseColor);

    let optimalS = s;
    let optimalL = l;

    if (l < 25) optimalL = 45;
    else if (l > 75) optimalL = 55;
    else optimalL = l;

    if (s < 30) optimalS = 50;
    else if (s > 85) optimalS = 75;
    else optimalS = s;

    const optimal500 = hslToHex(h, optimalS, optimalL);

    return {
        50: mix('#ffffff', optimal500, 0.05),
        100: mix('#ffffff', optimal500, 0.12),
        200: mix('#ffffff', optimal500, 0.25),
        300: mix('#ffffff', optimal500, 0.38),
        400: mix('#ffffff', optimal500, 0.50),
        500: optimal500,
        600: mix('#000000', optimal500, 0.12),
        700: mix('#000000', optimal500, 0.25),
        800: mix('#000000', optimal500, 0.38),
        900: mix('#000000', optimal500, 0.50),
        950: mix('#000000', optimal500, 0.75)
    };
}

function readBaseColor(envName) {
    const envPath = path.join(process.cwd(), 'src', 'environments', envName);

    if (!fs.existsSync(envPath)) {
        throw new Error(`No se encontró ${envPath}`);
    }

    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/baseColor:\s*['"](#[a-fA-F0-9]{6})['"]/);

    if (!match) {
        throw new Error(`No se encontró baseColor en ${envName}`);
    }

    return match[1];
}

function generateThemeFile(baseColor, isDevelopment) {
    const palette = generateOptimalPalette(baseColor);

    const content = `export const theme = {
  ${isDevelopment ? 'development: true,' : 'development: false,'}
  primary: {
    50: '${palette[50]}',
    100: '${palette[100]}',
    200: '${palette[200]}',
    300: '${palette[300]}',
    400: '${palette[400]}',
    500: '${palette[500]}',
    600: '${palette[600]}',
    700: '${palette[700]}',
    800: '${palette[800]}',
    900: '${palette[900]}',
    950: '${palette[950]}'
  }
};
`;

    return content;
}

function updateManifest(baseColor) {
    const manifestPath = path.join(process.cwd(), 'public', 'manifest.webmanifest');

    if (!fs.existsSync(manifestPath)) {
        console.log('  manifest.webmanifest no encontrado, omitiendo');
        return;
    }

    const manifestContent = fs.readFileSync(manifestPath, 'utf8');

    try {
        const manifest = JSON.parse(manifestContent);
        manifest.theme_color = baseColor;

        const updatedManifest = JSON.stringify(manifest, null, 2);
        fs.writeFileSync(manifestPath, updatedManifest, 'utf8');
        console.log(`  theme_color actualizado: ${baseColor}`);
    } catch (e) {
        console.log('  Error al parsear manifest, omitiendo');
    }
}

function main() {
    console.log(`Generate Colors [${env.toUpperCase()}]: Generando paleta de colores y preconnects\n`);

    try {
        const baseColor = readBaseColor(envFile);
        console.log(`Base color leído de ${envFile}: ${baseColor}`);

        const themeContent = generateThemeFile(baseColor, isDev);

        const themePath = path.join(process.cwd(), 'src', 'environments', themeFile);
        fs.writeFileSync(themePath, themeContent, 'utf8');

        const palette = generateOptimalPalette(baseColor);
        console.log(`\nPaleta generada para ${isDev ? 'DESARROLLO' : 'PRODUCCIÓN'}:`);
        console.log(`  Color principal: ${palette[500]}`);
        console.log(`\nArchivo creado: src/environments/${themeFile}`);

        generatePreconnects(isDev);
        updateManifest(baseColor);
        console.log(`\n[>] Colores actualizados!`);

    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

function readEnvUrls() {
    const envPath = path.join(process.cwd(), 'src', 'environments', envFile);
    const content = fs.readFileSync(envPath, 'utf8');

    const urls = [];

    const apiUrlMatch = content.match(/apiUrl:\s*['"]([^'"]+)['"]/);
    if (apiUrlMatch) {
        const url = new URL(apiUrlMatch[1]);
        urls.push(url.origin);
    }

    const agentHostMatch = content.match(/agentHost:\s*['"]([^'"]+)['"]/);
    if (agentHostMatch) {
        const url = new URL(agentHostMatch[1]);
        if (!urls.includes(url.origin)) {
            urls.push(url.origin);
        }
    }

    return urls;
}

function generatePreconnects(isDev) {
    const urls = readEnvUrls();

    const fontsPreconnect = ``;

    let preconnectsContent = '';
    if (urls.length > 0) {
        const apiPreconnects = urls.map(url => `  <link rel="preconnect" href="${url}">`).join('\n');
        preconnectsContent = `\n\n  <!-- Preconnect for external APIs -->
${apiPreconnects}`;
    }

    const preconnectBlock = `<!-- PRECONNECT_BLOCK -->${fontsPreconnect}${preconnectsContent}<!-- /PRECONNECT_BLOCK -->`;

    const indexPath = path.join(process.cwd(), 'src', 'index.html');
    let indexContent = fs.readFileSync(indexPath, 'utf8');

    const preconnectRegex = /<!-- PRECONNECT_BLOCK -->[\s\S]*?<!-- \/PRECONNECT_BLOCK -->/;
    if (preconnectRegex.test(indexContent)) {
        indexContent = indexContent.replace(preconnectRegex, preconnectBlock);
    } else {
        const headMatch = indexContent.match(/<head>([\s\S]*?)<\/head>/);
        if (headMatch) {
            const newHead = headMatch[1].replace(
                /<link rel="preconnect"[^>]*>/g,
                ''
            );
            indexContent = indexContent.replace(
                /<head>[\s\S]*?<\/head>/,
                `<head>${newHead}${preconnectBlock}\n</head>`
            );
        }
    }

    fs.writeFileSync(indexPath, indexContent, 'utf8');
    console.log(`Preconnects actualizados para ${isDev ? 'DESARROLLO' : 'PRODUCCIÓN'}:`);
    urls.forEach(url => console.log(`  - ${url}`));
}

const angularJsonPath = path.join(process.cwd(), 'angular.json');
if (!fs.existsSync(angularJsonPath)) {
    console.error('Error: No es un proyecto Angular');
    process.exit(1);
}

main();
