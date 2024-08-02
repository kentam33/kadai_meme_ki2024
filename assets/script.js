let gl;
let program;
let positionBuffer;
let texCoordBuffer;
let currentImageIndex = 0;
let targetImageIndex = 0;
let images = ['images/01.jpg', 'images/02.jpg', 'images/04.jpg', 'images/05.jpg', 'images/06.jpg', 'images/03.jpg', 'images/07.jpg', 'images/08.jpg', 'images/09.jpg', 'images/11.jpg', 'images/10.jpg', 'images/12.jpg'];
let currentTexture, nextTexture;
let startTime;
let transitionStartTime;
let isTransitioning = false;
const transitionDuration = 3.5; // フェードの持続時間（秒）
let texturesLoaded = 0;
let scrollPosition = 0;

// シェーダーのソースコード
const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec2 aTextureCoord;
    varying vec2 vTextureCoord;
    void main() {
        gl_Position = aVertexPosition;
        vTextureCoord = aTextureCoord;
    }
`;

const fsSource = `
    precision mediump float;
    uniform sampler2D uCurrentTexture;
    uniform sampler2D uNextTexture;
    uniform float uTime;
    uniform float uTransitionProgress;
    varying vec2 vTextureCoord;
    void main() {
        vec2 uv = vTextureCoord;
        uv.x += sin(uv.y * 10.0 + uTime * 0.5) * 0.01;
        uv.y += cos(uv.x * 10.0 + uTime * 0.5) * 0.01;
        vec4 currentColor = texture2D(uCurrentTexture, uv);
        vec4 nextColor = texture2D(uNextTexture, uv);
        gl_FragColor = mix(currentColor, nextColor, uTransitionProgress);
    }
`;

function initWebGL() {
    const canvas = document.getElementById('glCanvas');
    gl = canvas.getContext('webgl');

    if (!gl) {
        alert('WebGL not supported');
        return;
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    program = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
            textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
        },
        uniformLocations: {
            uCurrentTexture: gl.getUniformLocation(shaderProgram, 'uCurrentTexture'),
            uNextTexture: gl.getUniformLocation(shaderProgram, 'uNextTexture'),
            uTime: gl.getUniformLocation(shaderProgram, 'uTime'),
            uTransitionProgress: gl.getUniformLocation(shaderProgram, 'uTransitionProgress'),
        },
    };

    initBuffers();
    loadTextures();

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);

    startTime = Date.now();
    requestAnimationFrame(render);
}

function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function initBuffers() {
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
        -1.0,  1.0,
         1.4,  1.0,
        -2.5, -1.0,
         1.0, -1.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    const textureCoordinates = [
        0.0,  0.0,
        1.0,  0.0,
        0.0,  1.0,
        1.0,  1.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);
}

function loadTextures() {
    currentTexture = loadTexture(images[currentImageIndex], () => {
        texturesLoaded++;
        if (texturesLoaded === 2) startTime = Date.now();
    });
    nextTexture = loadTexture(images[(currentImageIndex + 1) % images.length], () => {
        texturesLoaded++;
        if (texturesLoaded === 2) startTime = Date.now();
    });
}

function loadTexture(url, callback) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 0, 0]);  // 透明なピクセル
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  width, height, border, srcFormat, srcType,
                  pixel);

    const image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                      srcFormat, srcType, image);

        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            gl.generateMipmap(gl.TEXTURE_2D);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
        callback();
    };
    image.src = url;
    return texture;
}

function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}

function handleScroll() {
    scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    const totalScrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollProgress = scrollPosition / totalScrollHeight;
    
    targetImageIndex = Math.floor(scrollProgress * images.length);
    
    if (targetImageIndex !== currentImageIndex && !isTransitioning) {
        startTransition();
    }
}

function handleResize() {
    const canvas = gl.canvas;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

function render() {
    if (texturesLoaded < 2) {
        requestAnimationFrame(render);
        return;
    }

    const currentTime = (Date.now() - startTime) / 1000;

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(program.attribLocations.vertexPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(program.attribLocations.vertexPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(program.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(program.attribLocations.textureCoord);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentTexture);
    gl.uniform1i(program.uniformLocations.uCurrentTexture, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, nextTexture);
    gl.uniform1i(program.uniformLocations.uNextTexture, 1);

    gl.uniform1f(program.uniformLocations.uTime, currentTime);

    let transitionProgress = 0;
    if (isTransitioning) {
        const transitionTime = (Date.now() - transitionStartTime) / 1000;
        transitionProgress = Math.min(transitionTime / transitionDuration, 1.0);
        if (transitionProgress >= 1.0) {
            endTransition();
        }
    }
    gl.uniform1f(program.uniformLocations.uTransitionProgress, transitionProgress);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(render);
}

function startTransition() {
    if (texturesLoaded < 2) return;
    isTransitioning = true;
    transitionStartTime = Date.now();
    nextTexture = loadTexture(images[targetImageIndex], () => {
        texturesLoaded = 2;
    });
}

function endTransition() {
    isTransitioning = false;
    currentImageIndex = targetImageIndex;
    currentTexture = nextTexture;
    if (targetImageIndex !== currentImageIndex) {
        nextTexture = loadTexture(images[targetImageIndex], () => {
            texturesLoaded = 2;
        });
    }
}

function setPageHeight() {
    const pageHeight = window.innerHeight * (images.length + 1);
    document.body.style.height = `${pageHeight}px`;
}

window.onload = () => {
    initWebGL();
    setPageHeight();
};