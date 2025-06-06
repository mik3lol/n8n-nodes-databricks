const path = require('path');
const { task, src, dest } = require('gulp');

task('build:icons', copyIcons);

function copyIcons() {
    // Copy from nodes directory
    const nodeSource = path.resolve('nodes', '**', '*.{svg,png}');
    const nodeDestination = path.resolve('dist', 'nodes');
    src(nodeSource).pipe(dest(nodeDestination));

    // Copy from credentials directory
    const credSource = path.resolve('credentials', '**', '*.{svg,png}');
    const credDestination = path.resolve('dist', 'credentials');
    return src(credSource).pipe(dest(credDestination));
}