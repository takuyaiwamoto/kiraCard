let scene, camera, renderer;
let hologramMaterial;
let imageTexture;
let tiltX = 0, tiltY = 0;
let targetTiltX = 0, targetTiltY = 0;
let currentEffectIndex = 0;
let mesh;
let isLenticularMode = false;
let currentAngleStep = 3; // 0-6の7段階、3が中央
let currentVerticalStep = 3; // 0-6の7段階、3が中央
let currentImageAspectRatio = 1.0; // 現在の画像のアスペクト比

// 7段階の角度名
const angleNames = ['左々', '左+', '左', '中央', '右', '右+', '右々'];
const verticalNames = ['上々', '上+', '上', '中央', '下', '下+', '下々'];

const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fragmentShader1 = `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec2 tilt;
    uniform int angleStep;
    uniform int verticalStep;
    uniform vec2 resolution;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    
    void main() {
        // 49段階に対応したUVオフセット計算（7×7）
        float hOffset = float(angleStep - 3) * 0.05; // 水平方向
        float vOffset = float(verticalStep - 3) * 0.04; // 垂直方向
        vec2 shiftedUV = vUv + vec2(hOffset, vOffset);
        shiftedUV.x = fract(shiftedUV.x);
        shiftedUV.y = fract(shiftedUV.y);
        
        vec4 texColor = texture2D(tDiffuse, shiftedUV);
        
        // 視線ベクトルの正規化
        vec3 viewDir = normalize(vViewPosition);
        
        // 傾きに基づく仮想光源の位置
        vec3 lightPos = vec3(tilt.x * 2.0, tilt.y * 2.0, 1.0);
        vec3 lightDir = normalize(lightPos);
        
        // Fresnel効果
        float fresnel = pow(1.0 - dot(viewDir, vNormal), 2.0);
        
        // 反射計算
        vec3 reflectDir = reflect(-lightDir, vNormal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
        
        // ホログラム効果のための虹色グラデーション
        float angle = atan(tilt.y, tilt.x);
        float hue = angle / (2.0 * 3.14159) + 0.5;
        hue = fract(hue + time * 0.1);
        
        // 位置ベースのパターン
        vec2 pattern = vUv * 10.0 + tilt * 5.0;
        float wave = sin(pattern.x + time) * cos(pattern.y + time) * 0.5 + 0.5;
        
        // 虹色の生成
        vec3 rainbowColor = hsv2rgb(vec3(hue + wave * 0.2, 0.8, 1.0));
        
        // キラキラ効果
        vec2 sparkleCoord = vUv * 50.0 + tilt * 20.0;
        float sparkle = smoothstep(0.98, 1.0, sin(sparkleCoord.x + time * 3.0) * sin(sparkleCoord.y - time * 2.0));
        
        // 最終的な色の合成
        vec3 finalColor = texColor.rgb;
        finalColor += rainbowColor * fresnel * 0.5;
        finalColor += vec3(spec) * 0.8;
        finalColor += vec3(sparkle) * 2.0;
        
        // 傾きによる輝度調整
        float brightness = 1.0 + length(tilt) * 0.3;
        finalColor *= brightness;
        
        gl_FragColor = vec4(finalColor, texColor.a);
    }
`;

// エフェクト2: プリズム分光効果
const fragmentShader2 = `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec2 tilt;
    uniform int angleStep;
    uniform int verticalStep;
    uniform vec2 resolution;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    
    void main() {
        // 49段階に対応したUVオフセット計算（7×7）
        float hOffset = float(angleStep - 3) * 0.05; // 水平方向
        float vOffset = float(verticalStep - 3) * 0.04; // 垂直方向
        vec2 shiftedUV = vUv + vec2(hOffset, vOffset);
        shiftedUV.x = fract(shiftedUV.x);
        shiftedUV.y = fract(shiftedUV.y);
        
        vec4 texColor = texture2D(tDiffuse, shiftedUV);
        vec3 viewDir = normalize(vViewPosition);
        
        // プリズム効果の強度計算
        float prismStrength = abs(float(angleStep - 3)) * 0.01 + length(tilt) * 0.02;
        
        // RGBチャンネルを分離してずらす
        vec2 redOffset = shiftedUV + vec2(prismStrength * tilt.x, prismStrength * tilt.y);
        vec2 greenOffset = shiftedUV;
        vec2 blueOffset = shiftedUV - vec2(prismStrength * tilt.x, prismStrength * tilt.y);
        
        vec3 chromatic;
        chromatic.r = texture2D(tDiffuse, redOffset).r;
        chromatic.g = texture2D(tDiffuse, greenOffset).g;
        chromatic.b = texture2D(tDiffuse, blueOffset).b;
        
        // 光沢のストライプパターン
        float stripePattern = sin((vUv.x - vUv.y) * 30.0 + tilt.x * 10.0 + time * 2.0) * 0.5 + 0.5;
        float gloss = smoothstep(0.7, 0.9, stripePattern) * abs(tilt.x + tilt.y);
        
        // ダイヤモンドのような点滅
        vec2 sparklePos = vUv * 20.0;
        float diamondSparkle = 0.0;
        for(float i = 0.0; i < 3.0; i++) {
            vec2 offset = vec2(sin(i * 2.1), cos(i * 2.1)) * 0.1;
            vec2 p = sparklePos + offset + tilt * 10.0;
            float spark = smoothstep(0.99, 1.0, sin(p.x + time * 5.0) * sin(p.y - time * 3.0));
            diamondSparkle += spark;
        }
        
        vec3 finalColor = chromatic;
        finalColor += vec3(gloss) * 0.5;
        finalColor += vec3(diamondSparkle) * 1.5;
        
        // 全体的な明度調整
        finalColor *= 1.0 + length(tilt) * 0.4;
        
        gl_FragColor = vec4(finalColor, texColor.a);
    }
`;

// エフェクト3: オーロラ波動効果
const fragmentShader3 = `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec2 tilt;
    uniform int angleStep;
    uniform int verticalStep;
    uniform vec2 resolution;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    
    float noise(vec2 p) {
        return sin(p.x * 10.0) * sin(p.y * 10.0);
    }
    
    void main() {
        // 49段階に対応したUVオフセット計算（7×7）
        float hOffset = float(angleStep - 3) * 0.05; // 水平方向
        float vOffset = float(verticalStep - 3) * 0.04; // 垂直方向
        vec2 shiftedUV = vUv + vec2(hOffset, vOffset);
        shiftedUV.x = fract(shiftedUV.x);
        shiftedUV.y = fract(shiftedUV.y);
        
        vec4 texColor = texture2D(tDiffuse, shiftedUV);
        vec3 viewDir = normalize(vViewPosition);
        
        // オーロラのような波動パターン
        vec2 waveCoord = shiftedUV + tilt * 0.3;
        float wave1 = sin(waveCoord.x * 15.0 + time * 2.0 + tilt.x * 5.0) * 0.5 + 0.5;
        float wave2 = sin(waveCoord.y * 12.0 - time * 1.5 + tilt.y * 5.0) * 0.5 + 0.5;
        float wave3 = sin(length(waveCoord - 0.5) * 20.0 - time * 3.0) * 0.5 + 0.5;
        
        float wavePattern = wave1 * wave2 * wave3;
        
        // 動的な色相シフト
        float hueShift = time * 0.2 + length(tilt) * 0.5 + wavePattern * 0.3;
        vec3 auroraColor1 = hsv2rgb(vec3(hueShift, 0.9, 1.0));
        vec3 auroraColor2 = hsv2rgb(vec3(hueShift + 0.3, 0.8, 1.0));
        vec3 auroraColor3 = hsv2rgb(vec3(hueShift + 0.6, 0.7, 1.0));
        
        // レイヤー効果
        vec3 layer1 = auroraColor1 * smoothstep(0.3, 0.7, wavePattern);
        vec3 layer2 = auroraColor2 * smoothstep(0.5, 0.9, wave1 * wave2);
        vec3 layer3 = auroraColor3 * smoothstep(0.4, 0.8, wave3);
        
        // 流れるような光の筋
        float flow = sin(vUv.x * 30.0 + vUv.y * 20.0 - time * 4.0 + tilt.x * 10.0);
        float flowMask = smoothstep(0.8, 1.0, flow) * (0.5 + 0.5 * sin(time * 5.0));
        
        vec3 finalColor = texColor.rgb;
        finalColor += (layer1 + layer2 + layer3) * 0.4 * (0.5 + length(tilt));
        finalColor += vec3(flowMask) * 1.2;
        
        // 明度とコントラスト調整
        finalColor = mix(texColor.rgb, finalColor, 0.7);
        finalColor *= 1.0 + length(tilt) * 0.5;
        
        gl_FragColor = vec4(finalColor, texColor.a);
    }
`;

// エフェクト4: グリッド構造ホログラム
const fragmentShader4 = `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec2 tilt;
    uniform int angleStep;
    uniform int verticalStep;
    uniform vec2 resolution;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    
    void main() {
        // 49段階に対応したUVオフセット計算（7×7）
        float hOffset = float(angleStep - 3) * 0.05; // 水平方向
        float vOffset = float(verticalStep - 3) * 0.04; // 垂直方向
        vec2 shiftedUV = vUv + vec2(hOffset, vOffset);
        shiftedUV.x = fract(shiftedUV.x);
        shiftedUV.y = fract(shiftedUV.y);
        
        vec4 texColor = texture2D(tDiffuse, shiftedUV);
        
        // グリッド構造の設定
        float gridSize = 16.0; // 16x16のグリッド
        vec2 gridUV = fract(vUv * gridSize);
        vec2 gridID = floor(vUv * gridSize);
        
        // 各グリッドセルの中心からの距離
        vec2 cellCenter = gridUV - 0.5;
        float cellRadius = length(cellCenter);
        float cellAngle = atan(cellCenter.y, cellCenter.x);
        
        // セルごとの色相オフセット（左上から右下へのグラデーション）
        float hueOffset = (gridID.x + gridID.y) / (gridSize * 2.0);
        hueOffset += length(tilt) * 0.5; // 傾きによる色相変化
        
        // 円錐型のシェーディング（中心が明るく、周囲が暗い）
        float conicalShading = 1.0 - smoothstep(0.1, 0.4, cellRadius);
        conicalShading = max(conicalShading, 0.3); // 最小値を設定して真っ黒を防ぐ
        
        // 回転方向の統一（照明方向の錯覚）
        float rotationPhase = time * 0.5 + length(tilt) * 2.0;
        float lightDirection = cellAngle + rotationPhase;
        float directionalLight = cos(lightDirection) * 0.3 + 0.7; // 明るめに調整
        
        // 虹色グラデーション（左上から右下）
        float rainbowHue = hueOffset + directionalLight * 0.2;
        rainbowHue = fract(rainbowHue);
        
        // 彩度と明度の調整（明るめに設定）
        float saturation = 0.7 + conicalShading * 0.2;
        float brightness = 0.7 + conicalShading * 0.3; // ベース明度を上げる
        
        vec3 gridColor = hsv2rgb(vec3(rainbowHue, saturation, brightness));
        
        // 金属的光沢（ハイライト）
        float metallic = pow(conicalShading, 3.0) * directionalLight;
        vec3 highlight = vec3(1.0, 1.0, 1.0) * metallic * 0.3;
        
        // 最終的な色の合成（グリッドラインを削除してシンプルに）
        vec3 finalColor = texColor.rgb;
        finalColor = mix(finalColor, gridColor, 0.5); // グリッド効果をブレンド
        finalColor += highlight; // ハイライト追加
        
        // 全体的な輝度調整
        float overallBrightness = 1.0 + length(tilt) * 0.3;
        finalColor *= overallBrightness;
        
        gl_FragColor = vec4(finalColor, texColor.a);
    }
`;

// レンチキュラー版シェーダー1: グリッド構造ホログラム
const lenticularShader1 = `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform int angleStep; // 0-6の7段階
    uniform vec2 resolution;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    
    void main() {
        // 49段階に対応したUVオフセット計算（7×7）
        float hOffset = float(angleStep - 3) * 0.05; // 水平方向
        float vOffset = float(verticalStep - 3) * 0.04; // 垂直方向
        vec2 shiftedUV = vUv + vec2(hOffset, vOffset);
        shiftedUV.x = fract(shiftedUV.x);
        shiftedUV.y = fract(shiftedUV.y);
        
        vec4 texColor = texture2D(tDiffuse, shiftedUV);
        
        // グリッド構造の設定（角度ステップで変化）
        float gridSize = 12.0 + float(angleStep) * 2.0; // 角度で密度変化
        vec2 gridUV = fract(vUv * gridSize);
        vec2 gridID = floor(vUv * gridSize);
        
        // 各グリッドセルの中心からの距離
        vec2 cellCenter = gridUV - 0.5;
        float cellRadius = length(cellCenter);
        float cellAngle = atan(cellCenter.y, cellCenter.x);
        
        // セルごとの色相オフセット（角度ステップで色相が変化）
        float hueOffset = (gridID.x + gridID.y) / (gridSize * 2.0);
        hueOffset += float(angleStep) * 0.15; // 角度ステップによる色相シフト
        
        // 円錐型のシェーディング（中心が明るく、周囲が暗い）
        float conicalShading = 1.0 - smoothstep(0.1, 0.4, cellRadius);
        conicalShading = max(conicalShading, 0.4); // 最小値を設定
        
        // 回転方向の統一（照明方向の錯覚、角度ステップで変化）
        float rotationPhase = time * 0.3 + float(angleStep) * 0.8;
        float lightDirection = cellAngle + rotationPhase;
        float directionalLight = cos(lightDirection) * 0.3 + 0.7; // 明るめに調整
        
        // 虹色グラデーション（左上から右下、角度で強調）
        float rainbowHue = hueOffset + directionalLight * 0.3;
        rainbowHue = fract(rainbowHue);
        
        // 彩度と明度の調整（角度で変化、明るめに設定）
        float saturation = 0.6 + conicalShading * 0.3;
        float brightness = 0.7 + conicalShading * 0.3; // ベース明度を上げる
        
        vec3 gridColor = hsv2rgb(vec3(rainbowHue, saturation, brightness));
        
        // 金属的光沢（ハイライト、角度で強度変化）
        float metallic = pow(conicalShading, 2.0) * directionalLight;
        float metallicIntensity = 0.3 + abs(float(angleStep - 3)) * 0.1;
        vec3 highlight = vec3(1.0, 1.0, 1.0) * metallic * metallicIntensity;
        
        // 最終的な色の合成（シンプルに）
        vec3 finalColor = texColor.rgb;
        finalColor = mix(finalColor, gridColor, 0.6); // グリッド効果をブレンド
        finalColor += highlight; // ハイライト追加
        
        // 角度による全体的な輝度調整
        float angleFactor = abs(float(angleStep - 3)) / 3.0;
        float brightness = 1.0 + angleFactor * 0.3;
        
        gl_FragColor = vec4(finalColor, texColor.a);
    }
`;

const fragmentShaders = [fragmentShader1, fragmentShader2, fragmentShader3, fragmentShader4];
const lenticularShaders = [lenticularShader1, lenticularShader1, lenticularShader1, lenticularShader1]; // 暫定的に全てレンチキュラー版使用
const effectNames = ['レインボーホログラム', 'プリズムダイヤモンド', 'オーロラウェーブ', 'グリッドホログラム'];

function init() {
    // シーンの作成
    scene = new THREE.Scene();
    
    // カメラの作成
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 5;
    
    // レンダラーの作成
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('canvas'),
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // 初期画像の読み込み
    loadInitialImage();
    
    // マテリアルの作成
    hologramMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tDiffuse: { value: imageTexture },
            time: { value: 0 },
            tilt: { value: new THREE.Vector2(0, 0) },
            angleStep: { value: currentAngleStep },
            verticalStep: { value: currentVerticalStep },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShaders[0],
        side: THREE.DoubleSide
    });
    
    // 平面ジオメトリの作成（アスペクト比は後で調整）
    const geometry = new THREE.PlaneGeometry(4, 4, 32, 32);
    mesh = new THREE.Mesh(geometry, hologramMaterial);
    scene.add(mesh);
    
    // 初期アスペクト比の設定（loadInitialImageで設定されるので、ここではデフォルト値のみ）
    if (currentImageAspectRatio && imageTexture) {
        updateMeshAspectRatio(currentImageAspectRatio);
    }
    
    // イベントリスナーの設定
    window.addEventListener('resize', onWindowResize);
    setupDeviceMotion();
    setupFileUpload();
    setupEffectButtons();
    setupModeButtons();
    
    // アニメーションループ開始
    animate();
}

function setupModeButtons() {
    const modeButton = document.getElementById('modeButton');
    const modeName = document.getElementById('modeName');
    const angleDisplay = document.getElementById('angleDisplay');
    
    modeButton.addEventListener('click', () => {
        isLenticularMode = !isLenticularMode;
        console.log('Lenticular mode:', isLenticularMode);
        
        if (isLenticularMode) {
            modeButton.textContent = '通常モード';
            modeName.textContent = 'レンチキュラーモード';
            angleDisplay.style.display = 'block';
            updateAngleDisplay();
        } else {
            modeButton.textContent = 'レンチキュラーモード';
            modeName.textContent = '通常モード';
            angleDisplay.style.display = 'none';
        }
        
        // シェーダーを更新
        const shaderArray = isLenticularMode ? lenticularShaders : fragmentShaders;
        console.log('Switching to shader:', shaderArray[currentEffectIndex] === lenticularShader1 ? 'lenticular' : 'normal');
        hologramMaterial.fragmentShader = shaderArray[currentEffectIndex];
        hologramMaterial.needsUpdate = true;
    });
}

function setupEffectButtons() {
    const effectButton = document.getElementById('effectButton');
    const effectName = document.getElementById('effectName');
    
    effectName.textContent = effectNames[currentEffectIndex];
    
    effectButton.addEventListener('click', () => {
        currentEffectIndex = (currentEffectIndex + 1) % fragmentShaders.length;
        effectName.textContent = effectNames[currentEffectIndex];
        
        // 現在のモードに応じてシェーダーを選択
        const shaderArray = isLenticularMode ? lenticularShaders : fragmentShaders;
        hologramMaterial.fragmentShader = shaderArray[currentEffectIndex];
        hologramMaterial.needsUpdate = true;
    });
}

function createDefaultTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // 49段階表示用のグリッド背景（7×7）
    const cellWidth = 512 / 7; // ≈ 73
    const cellHeight = 512 / 7; // ≈ 73
    
    for(let v = 0; v < 7; v++) {
        for(let h = 0; h < 7; h++) {
            const x = h * cellWidth;
            const y = v * cellHeight;
            const hue = (h * 50 + v * 30) % 360;
            const lightness = 40 + ((h + v) * 4) % 40; // グラデーション
            
            ctx.fillStyle = `hsl(${hue}, 80%, ${lightness}%)`;
            ctx.fillRect(x, y, cellWidth, cellHeight);
            
            // 各セクションに小さなテキスト
            ctx.fillStyle = 'white';
            ctx.font = 'bold 8px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${angleNames[h]}`, x + cellWidth/2, y + cellHeight/2 - 8);
            ctx.fillText(`${verticalNames[v]}`, x + cellWidth/2, y + cellHeight/2 + 8);
        }
    }
    
    // 中央にタイトル
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(128, 180, 256, 152);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('HOLOGRAM', 256, 220);
    ctx.font = '14px Arial';
    ctx.fillText('49段階変化（7×7）', 256, 250);
    ctx.fillText('水平+垂直対応', 256, 270);
    ctx.font = '12px Arial';
    ctx.fillText('Complete Grid Control', 256, 300);
    
    imageTexture = new THREE.CanvasTexture(canvas);
}

function loadInitialImage() {
    const loader = new THREE.TextureLoader();
    loader.load(
        'myutu.jpg',
        function(texture) {
            console.log('Initial image loaded successfully');
            // テクスチャの設定
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.minFilter = texture.magFilter = THREE.LinearFilter;
            
            // アスペクト比を計算して適用
            const aspectRatio = texture.image.width / texture.image.height;
            currentImageAspectRatio = aspectRatio;
            console.log('Initial image aspect ratio:', aspectRatio, 'dimensions:', texture.image.width, 'x', texture.image.height);
            
            imageTexture = texture;
            
            // マテリアルが作成済みの場合は更新
            if (hologramMaterial) {
                hologramMaterial.uniforms.tDiffuse.value = texture;
                hologramMaterial.needsUpdate = true;
                updateMeshAspectRatio(aspectRatio);
            }
        },
        function(progress) {
            console.log('Loading initial image:', progress);
        },
        function(error) {
            console.error('Error loading initial image:', error);
            // エラーの場合はデフォルトテクスチャを作成
            createDefaultTexture();
            currentImageAspectRatio = 1.0;
            if (hologramMaterial) {
                hologramMaterial.uniforms.tDiffuse.value = imageTexture;
                hologramMaterial.needsUpdate = true;
                updateMeshAspectRatio(1.0);
            }
        }
    );
}

function setupDeviceMotion() {
    if (window.DeviceOrientationEvent) {
        // iOS 13+ ではパーミッションが必要
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            // ユーザーインタラクションが必要なので、ボタンクリック時に実行
            const button = document.querySelector('.upload-button');
            button.addEventListener('click', () => {
                DeviceOrientationEvent.requestPermission()
                    .then(response => {
                        if (response === 'granted') {
                            window.addEventListener('deviceorientation', handleOrientation);
                        }
                    })
                    .catch(console.error);
            }, { once: true });
        } else {
            window.addEventListener('deviceorientation', handleOrientation);
        }
    }
    
    // マウスでのフォールバック（PC用）
    window.addEventListener('mousemove', handleMouseMove);
}

function handleOrientation(event) {
    // beta: -180 to 180 (前後の傾き)
    // gamma: -90 to 90 (左右の傾き)
    const gamma = event.gamma || 0;
    const beta = event.beta || 0;
    
    console.log('Device orientation:', { gamma, beta });
    
    // 左右7段階判定（gammaメイン）
    let hStep = Math.floor((gamma + 60) / 120 * 7);
    hStep = Math.max(0, Math.min(6, hStep));
    
    // 上下7段階判定 (betaの前後傾きを使用)
    let vStep = Math.floor((beta + 60) / 120 * 7);
    vStep = Math.max(0, Math.min(6, vStep));
    
    let updated = false;
    if(hStep !== currentAngleStep) {
        currentAngleStep = hStep;
        updated = true;
    }
    
    if(vStep !== currentVerticalStep) {
        currentVerticalStep = vStep;
        updated = true;
    }
    
    if(updated) {
        console.log('Steps updated:', { hStep, vStep, angles: angleNames[hStep], vertical: verticalNames[vStep] });
        if (isLenticularMode) {
            updateAngleDisplay();
        }
    }
    
    if (!isLenticularMode) {
        // 通常モードでもスムーズな傾きを保持
        targetTiltX = gamma / 90;
        targetTiltY = beta / 180;
        
        // 範囲制限
        targetTiltX = Math.max(-1, Math.min(1, targetTiltX));
        targetTiltY = Math.max(-1, Math.min(1, targetTiltY));
    }
}

function handleMouseMove(event) {
    const mouseX = (event.clientX / window.innerWidth - 0.5) * 2;
    const mouseY = (event.clientY / window.innerHeight - 0.5) * 2;
    
    // 左右7段階判定（X軸）
    let hStep = Math.floor((mouseX + 1) / 2 * 7);
    hStep = Math.max(0, Math.min(6, hStep));
    
    // 上下7段階判定（Y軸）
    let vStep = Math.floor((mouseY + 1) / 2 * 7);
    vStep = Math.max(0, Math.min(6, vStep));
    
    let updated = false;
    if(hStep !== currentAngleStep) {
        currentAngleStep = hStep;
        updated = true;
    }
    
    if(vStep !== currentVerticalStep) {
        currentVerticalStep = vStep;
        updated = true;
    }
    
    if(updated) {
        console.log('Mouse step changed to:', hStep, angleNames[hStep], '/', vStep, verticalNames[vStep]);
        if (isLenticularMode) {
            updateAngleDisplay();
        }
    }
    
    if (!isLenticularMode) {
        // 通常モードでもスムーズな傾きを保持
        targetTiltX = mouseX;
        targetTiltY = mouseY;
    }
}

function updateAngleDisplay() {
    const angleDisplay = document.getElementById('angleDisplay');
    if (angleDisplay) {
        angleDisplay.textContent = `角度: ${angleNames[currentAngleStep]} / ${verticalNames[currentVerticalStep]}`;
    }
}

function setupFileUpload() {
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileUpload);
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
        console.log('Invalid file type or no file selected');
        return;
    }
    
    console.log('Loading image file:', file.name, file.type);
    const reader = new FileReader();
    const loading = document.getElementById('loading');
    
    if (loading) {
        loading.style.display = 'block';
    }
    
    reader.onload = function(e) {
        console.log('FileReader onload triggered');
        const loader = new THREE.TextureLoader();
        loader.load(
            e.target.result, 
            function(texture) {
                console.log('Texture loaded successfully', texture);
                // テクスチャの設定を適切に行う
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.minFilter = texture.magFilter = THREE.LinearFilter;
                
                // アスペクト比を計算して適用
                const aspectRatio = texture.image.width / texture.image.height;
                currentImageAspectRatio = aspectRatio; // グローバル変数に保存
                console.log('Image aspect ratio:', aspectRatio, 'dimensions:', texture.image.width, 'x', texture.image.height);
                updateMeshAspectRatio(aspectRatio);
                
                imageTexture = texture;
                hologramMaterial.uniforms.tDiffuse.value = texture;
                hologramMaterial.needsUpdate = true; // シェーダーの更新を強制
                
                if (loading) {
                    loading.style.display = 'none';
                }
                console.log('Material texture updated and shader refreshed with aspect ratio:', aspectRatio);
            },
            function(progress) {
                console.log('Loading progress:', progress);
            },
            function(error) {
                console.error('Error loading texture:', error);
                if (loading) {
                    loading.style.display = 'none';
                }
            }
        );
    };
    
    reader.onerror = function(error) {
        console.error('FileReader error:', error);
        if (loading) {
            loading.style.display = 'none';
        }
    };
    
    reader.readAsDataURL(file);
}

function updateMeshAspectRatio(aspectRatio) {
    if (mesh) {
        // ウィンドウサイズを考慮してサイズを計算
        const windowAspect = window.innerWidth / window.innerHeight;
        const padding = 0.5; // 50%の余白を確保（50%のサイズ）
        
        // カメラの視野角75度、距離5での表示可能範囲を計算
        const fov = 75 * Math.PI / 180; // ラジアンに変換
        const distance = 5;
        const vHeight = 2 * Math.tan(fov / 2) * distance; // 垂直方向の表示可能サイズ
        const vWidth = vHeight * windowAspect; // 水平方向の表示可能サイズ
        
        let width, height;
        
        if (aspectRatio > windowAspect) {
            // 画像が画面より横長の場合、幅を基準に
            width = vWidth * padding;
            height = width / aspectRatio;
        } else {
            // 画像が画面より縦長の場合、高さを基準に
            height = vHeight * padding;
            width = height * aspectRatio;
        }
        
        mesh.scale.set(width, height, 1);
        console.log('Mesh scaled to:', width.toFixed(2), 'x', height.toFixed(2), 
                   'Window aspect:', windowAspect.toFixed(2), 'Image aspect:', aspectRatio.toFixed(2));
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    hologramMaterial.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    
    // 画像サイズも新しいウィンドウサイズに合わせて再調整
    updateMeshAspectRatio(currentImageAspectRatio);
}

function animate() {
    requestAnimationFrame(animate);
    
    if (!isLenticularMode) {
        // 通常モード: スムーズな傾き遷移
        tiltX += (targetTiltX - tiltX) * 0.1;
        tiltY += (targetTiltY - tiltY) * 0.1;
    }
    
    // uniform更新
    hologramMaterial.uniforms.time.value += 0.01;
    
    // 常に角度ステップを送信（通常モードでも画像移動で使用）
    hologramMaterial.uniforms.angleStep.value = currentAngleStep;
    hologramMaterial.uniforms.verticalStep.value = currentVerticalStep;
    
    if (!isLenticularMode) {
        // 通常モード: 傾きも送信（ホログラム効果用）
        hologramMaterial.uniforms.tilt.value.set(tiltX, tiltY);
    }
    
    renderer.render(scene, camera);
}

// 初期化
init();