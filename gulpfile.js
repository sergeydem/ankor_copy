/*
Streamlined Shopify theme development.

NOTE: depends on module gulp-shopify-theme

npm install --save-dev yargs gulp gulp-sass gulp-changed gulp-sourcemaps gulp-autoprefixer gulp-uglify gulp-concat gulp-replace gulp-plumber gulp-babel browser-sync gulp-if del gulp-add-src gulp-rename gulp-yaml gulp-shopify-theme

Highlights:

- https proxying via BrowserSync
- autoreload
- sourcemaps support
- YAML support for Shopify config/ and locales/ files

*/

const argv = require('yargs').argv;
const gulp = require( 'gulp' );
const sass = require( 'gulp-sass' );
const changed = require( 'gulp-changed' );
const sourcemaps = require( 'gulp-sourcemaps' );
const uglify = require( 'gulp-uglify' );
const concat = require( 'gulp-concat' );
const replace = require( 'gulp-replace' );
const plumber = require( 'gulp-plumber' );
const babel = require( 'gulp-babel' );
const browsersync = require( 'browser-sync' ).create();
const gulpif = require( 'gulp-if' );
const del = require( 'del' );
const addsrc = require( 'gulp-add-src' );
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const rename = require( 'gulp-rename' );
const yaml = require( 'gulp-yaml' );
const jsyaml = require( 'js-yaml' );
const theme = require( 'gulp-shopify-theme' ).create();
// var shopifyconfig = require( './~shopifyconfig.json' );
var shopifyconfig = {
    "api_key": "e8245ce2b2b0d129b98650133a24bc9d",
    "password": "156e623fbfb4dc7244a446af2ed99079",
    "shared_secret": "146fbda936c28e8b706f79cedc67588e",
    "shop_name": "demyanenko.myshopify.com",
    "theme_id": "21663875114"
}

// gulp.task( 'copy', ['shopify-theme-init'], function () {
//     return gulp.src( [ 'src/{layout,config,snippets,templates,locales}/**/*.*' ] )
//         .pipe( shopifytheme.stream() );
// });
//
// gulp.task( 'shopify-theme-init', function () {
//     shopifytheme.init(shopifyconfig);
// });
//
// gulp.task( 'watch', function () {
//     //
//     // …watch and compile tasks…
//     //
//
//     shopifytheme.on('done', browserSync.reload());
// });

var DESTINATION = argv.dest || 'dist';
var USE_JS_UGLIFY = !!(argv.uglify || process.env.USE_JS_UGLIFY);
var USE_SOURCEMAPS = !(argv.nomaps || process.env.DISABLE_SOURCEMAPS);
var USE_BROWSER_SYNC = !!(argv.browsersync || argv.bs || process.env.USE_BROWSER_SYNC);
var BROWSER_SYNC_PORT = parseInt(argv.browsersync) || parseInt(argv.bs) || parseInt(process.env.BROWSER_SYNC_PORT) || '3000';

const sourceMappingURLCSSregExp = new RegExp('(.*?[/*]{2,}# sourceMappingURL=)(.*?)([/*]{2})', 'g');
const sourceMappingURLJSregExp = new RegExp('(.*?[/*]{2,}# sourceMappingURL=)(.*?)', 'g');
const sourceMappingURLCSSreplace = '{% raw %}$1{% endraw %}$2{% raw %}$3{% endraw %}';
const sourceMappingURLJSreplace = '{% raw %}$1{% endraw %}$2';

shopifyconfig.root = process.cwd() + '/' + DESTINATION;

gulp.task( 'default', [ 'css', 'js', 'js-libs', 'fonts', 'images', 'copy', 'configs' ] );
gulp.task( 'dev', [ 'theme', 'default', 'browsersync', 'watch' ] );
gulp.task( 'clean', function () {
    return del(DESTINATION);
});

gulp.task( 'purge', [ 'theme' ], function (done) {
    theme.purge();
    done();
});

gulp.task( 'theme', function () {
    theme.init( shopifyconfig );
});

gulp.task( 'watch', function () {
    USE_JS_UGLIFY = false;

    // Watch & run tasks
    gulp.watch( 'assets/{css,css-libs}/**/*.{css,less,scss,liquid}', [ 'reload-on-css' ] );
    gulp.watch( 'assets/*.js', [ 'reload-on-js' ] );
    gulp.watch( 'assets/*.js', [ 'reload-on-js-libs' ] );
    gulp.watch( 'assets/*', [ 'reload-on-fonts' ] );
    gulp.watch( 'assets/*', [ 'reload-on-images' ] );
    gulp.watch( '{layout,config,snippets,sections,templates,locales}/**/*', [ 'reload-on-copy' ]);
});

gulp.task( 'css', function () {
    return gulp.src( 'assets/all.scss' )
        .pipe( plumber() )
        .pipe( sourcemaps.init() )
        .pipe( sass().on('error', sass.logError) )
        .pipe( replace( /({{|}}|{%|%})/g, '/*!$1*/' ) ) // Comment out Liquid tags, so post-css doesn't trip out
        .pipe( postcss( [
            autoprefixer({browsers: [ 'last 2 versions', 'Explorer >= 9' ]}),
            ] ) )
        .pipe( replace( /\/\*!({{|}}|{%|%})\*\//g, '$1' ) ) // Re-enable Liquid tags
        .pipe( rename( 'css_all.css' ) )
        .pipe( sourcemaps.write('.', {sourceMappingURL: makeLiquidSourceMappingURL})) // css_all.css.map
        .pipe( rename(appendLiquidExt)) // css_all.css.liquid
        .pipe( replace( sourceMappingURLCSSregExp, sourceMappingURLCSSreplace ) )
        .pipe( gulp.dest( DESTINATION + '/assets' ) )
        .pipe( theme.stream() );
});

gulp.task( 'js', function () {
    return gulp.src( [ 'assets/!(main)*.js', 'assets/main.js' ] )
        .pipe( plumber() )
        .pipe( sourcemaps.init() )
        .pipe( babel({presets: ['es2015']}) )
        .pipe( concat( 'js_script.js' ) )
        .pipe( gulpif( USE_JS_UGLIFY, uglify() ) )
        .pipe( sourcemaps.write('.', {sourceMappingURL: makeLiquidSourceMappingURL}))
        .pipe( rename(appendLiquidExt))
        .pipe( replace( sourceMappingURLJSregExp, sourceMappingURLJSreplace ) )
        .pipe( gulp.dest( DESTINATION + '/assets' ) )
        .pipe( theme.stream() );
});

gulp.task( 'js-libs', function () {
    return gulp.src( [ 'assets/jquery.js' , 'assets/*.js' ] )
        .pipe( plumber() )
        .pipe( concat( 'js_libs.js' ) )
        .pipe( gulpif( USE_JS_UGLIFY, uglify() ) )
        .pipe( gulp.dest( DESTINATION + '/assets' ) )
        .pipe( theme.stream() );
});

gulp.task( 'fonts', function () {
    return gulp.src( [ 'assets/**/*.{ttf,woff,woff2,eof,eot,otf,svg}' ] )
        .pipe( plumber() )
        .pipe( changed( DESTINATION, {hasChanged: changed.compareSha1Digest} ) )
        .pipe( rename( flatten ))
        .pipe( rename({ dirname: '', prefix: 'fonts_' }))
        .pipe( gulp.dest( DESTINATION + '/assets' ) )
        .pipe( theme.stream() );
});

gulp.task( 'images', function () {
    return gulp.src( [ 'assets/**/*.{svg,png,jpg,jpeg,gif,ico}', '!assets/src/**/*' ] )
        .pipe( plumber() )
        .pipe( changed( DESTINATION, {hasChanged: changed.compareSha1Digest} ) )
        .pipe( rename( flatten ))
        .pipe( rename({ dirname: '', prefix: 'images_' }))
        .pipe( gulp.dest( DESTINATION + '/assets' ) )
        .pipe( theme.stream() );
});

gulp.task( 'copy', function () {
    return gulp.src( [ '{layout,snippets,templates,sections}/**/*.*' ] )
        .pipe( plumber() )
        .pipe( replace( /{% schema %}([^]*.+[^]*){% endschema %}/gi, replaceYAMLwithJSON ) )
        .pipe( replace(/({%)(?!\s*?(?:end)?(?:raw|schema|javascript|stylesheet)\s*?)(.+?)(%})/g, '$1- $2 -$3') ) // make whitespace-insensitive tags {% -> {%-
        .pipe( replace( /^\s*[\r\n]/gm, '' ) ) // remove empty lines
        .pipe( changed( DESTINATION, {hasChanged: changed.compareSha1Digest} ) )
        .pipe( gulp.dest( DESTINATION ) )
        .pipe( theme.stream() );
});

gulp.task( 'configs', function () {
    return gulp.src( [ '{config,locales}/**/*.*' ] )
        .pipe( plumber() )
        .pipe( yaml({space: 2}) )
        .pipe( changed( DESTINATION, {hasChanged: changed.compareSha1Digest} ) )
        .pipe( gulp.dest( DESTINATION ) )
        .pipe( theme.stream() );
});

gulp.task('reload-on-css', ['css'], reload);
gulp.task('reload-on-js', ['js'], reload);
gulp.task('reload-on-js-libs', ['js-libs'], reload);
gulp.task('reload-on-fonts', ['fonts'], reload);
gulp.task('reload-on-images', ['images'], reload);
gulp.task('reload-on-copy', ['copy', 'configs'], reload);

function reload (done) {
    if (!USE_BROWSER_SYNC) return done();
    browsersync.reload(); done();
}

gulp.task( 'browsersync', function (done) {
    if (!USE_BROWSER_SYNC) return done();
    browsersync.init({
        port: BROWSER_SYNC_PORT, ui: { port: BROWSER_SYNC_PORT + 1 },
        proxy: 'https://'+ shopifyconfig.shop_name +'.myshopify.com',
        browser: [],
        notify: false,
        startPath: "/?preview_theme_id=" + shopifyconfig.theme_id,
    }, done);
});

console.log('DESTINATION', DESTINATION);
console.log('USE_JS_UGLIFY', USE_JS_UGLIFY);
console.log('USE_SOURCEMAPS', USE_SOURCEMAPS);
console.log('USE_BROWSER_SYNC', USE_BROWSER_SYNC);
console.log('BROWSER_SYNC_PORT', BROWSER_SYNC_PORT);

function replaceYAMLwithJSON (match, g1) {
    if (match) {
        var yamlString = g1.replace(/{% (end)?schema %}/, '');
        var parsedYaml = jsyaml.safeLoad(yamlString);
        var jsonString = JSON.stringify(parsedYaml, null, '    ');
        return '{% schema %}\n' + jsonString + '\n{% endschema %}';
    }
}

function makeLiquidSourceMappingURL (file) {
    return '{{"' + file.relative + '.map" | asset_url }}';
}

function appendLiquidExt (path) {
    if (path.extname === '.map') return;
    if (path.extname === '.css') {
        path.extname = '.scss';
    }
    path.basename += path.extname;
    path.extname = '.liquid';
}

function flatten (path) {
    if (path.dirname !== '.') {
        path.basename = path.dirname.replace('/', '_') + '_' + path.basename;
    }
}

