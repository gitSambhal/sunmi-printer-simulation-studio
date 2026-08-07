import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RotateCcw, Eye, Sparkles, Maximize2, Zap, Play, Scissors, Layers, Check, Volume2, FileText } from 'lucide-react';
import { ReceiptData, Alignment, ReceiptLine, TextSpan } from '../lib/escpos';

interface Sunmi3DPrinterProps {
  data: ReceiptData;
  width: '58mm' | '80mm';
  printedLineCount: number;
  isPrinting: boolean;
  activeCutAnimation: boolean;
  requestedCameraPreset?: 'macro' | '3/4' | 'front' | 'top' | 'floor';
  onTriggerCut?: () => void;
}

interface FallingPaper {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  vy: number;
  vz: number;
  rotX: number;
  rotZ: number;
  opacity: number;
  age: number;
  isLanded: boolean;
}

export const Sunmi3DPrinter: React.FC<Sunmi3DPrinterProps> = ({
  data,
  width,
  printedLineCount,
  isPrinting,
  activeCutAnimation,
  requestedCameraPreset,
  onTriggerCut,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const textureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Three.js object references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  const paperMeshRef = useRef<THREE.Mesh | null>(null);
  const paperTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const ledMeshRef = useRef<THREE.Mesh | null>(null);
  const ledLightRef = useRef<THREE.PointLight | null>(null);
  const cutterBladeRef = useRef<THREE.Mesh | null>(null);
  const paperRollRef = useRef<THREE.Mesh | null>(null);
  const topCoverRef = useRef<THREE.Group | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const groundMeshRef = useRef<THREE.Mesh | null>(null);

  const fallingPapersRef = useRef<FallingPaper[]>([]);

  const [isHatchOpen, setIsHatchOpen] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<'3/4' | 'macro' | 'front' | 'top' | 'floor'>('macro');
  const [isBrightStudio, setIsBrightStudio] = useState(() => {
    if (typeof document !== 'undefined') {
      return !document.documentElement.classList.contains('dark') && !document.body.classList.contains('dark');
    }
    return false;
  });

  const isHatchOpenRef = useRef(isHatchOpen);
  const isPaperCutRef = useRef(false);
  const lastCutLineIndexRef = useRef(-1);

  useEffect(() => {
    isHatchOpenRef.current = isHatchOpen;
  }, [isHatchOpen]);

  // Sync 3D Studio lighting with App Dark Mode status automatically
  useEffect(() => {
    const syncStudioWithDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
      setIsBrightStudio(!isDark);
    };

    syncStudioWithDarkMode();

    const observer = new MutationObserver(() => {
      syncStudioWithDarkMode();
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    if (document.body) {
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    return () => observer.disconnect();
  }, []);

  // Update Studio Lighting and Background Dynamically
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(isBrightStudio ? 0xf1f5f9 : 0x181a20);
    }
    if (hemiLightRef.current) {
      hemiLightRef.current.groundColor = new THREE.Color(isBrightStudio ? 0xcbcbcb : 0x444444);
    }
    if (groundMeshRef.current) {
      (groundMeshRef.current.material as THREE.MeshStandardMaterial).color = new THREE.Color(
        isBrightStudio ? 0xe2e8f0 : 0x222530
      );
    }
  }, [isBrightStudio]);

  // Helper to draw text lines onto offscreen 2D canvas for Three.js texture
  const updateReceiptTexture = () => {
    if (!textureCanvasRef.current) {
      textureCanvasRef.current = document.createElement('canvas');
    }

    const canvas = textureCanvasRef.current;
    // High-DPI thermal paper texture resolution for crisp legibility
    const canvasWidth = width === '58mm' ? 1024 : 1280;
    // Uniform, consistent edge margins (top = bottom = left = right = marginPx)
    const marginPx = width === '58mm' ? 84 : 104;
    const maxPrintableWidth = canvasWidth - marginPx * 2;

    const startIdx = lastCutLineIndexRef.current >= 0 ? lastCutLineIndexRef.current + 1 : 0;
    const activeLines = data.lines.slice(startIdx, printedLineCount);

    // First Pass: Calculate exact required content height so top/bottom margins are identical to side margins
    let contentHeightPx = marginPx; // Top margin

    if (activeLines.length === 0) {
      contentHeightPx += 180; // Default clean blank header when unprinted
    } else {
      activeLines.forEach((line) => {
        const isDoubleHeight = line.spans.some((s) => s.style.doubleHeight || s.style.scaleY > 1);
        const isDoubleWidth = line.spans.some((s) => s.style.doubleWidth || s.style.scaleX > 1);

        let fontSize = 36;
        if (isDoubleHeight && isDoubleWidth) fontSize = 58;
        else if (isDoubleHeight) fontSize = 48;
        else if (isDoubleWidth) fontSize = 42;

        contentHeightPx += fontSize * 1.35;
        if (line.hasCutHere) {
          contentHeightPx += 45;
        }
      });
      contentHeightPx += marginPx; // Bottom margin equal to top/side margins!
    }

    const requiredHeight = Math.max(280, Math.ceil(contentHeightPx));

    canvas.width = canvasWidth;
    canvas.height = requiredHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background: Bright pure white thermal receipt paper texture
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, requiredHeight);

    // Subtle thermal paper texture grain lines
    ctx.fillStyle = 'rgba(0,0,0,0.012)';
    for (let y = 0; y < requiredHeight; y += 6) {
      ctx.fillRect(0, y, canvasWidth, 1);
    }

    if (activeLines.length === 0) return;

    // Draw visible parsed receipt lines starting cleanly at top margin
    let currentY = marginPx;

    activeLines.forEach((line) => {
      ctx.save();

      const firstSpan = line.spans[0];
      const isUnderline = line.spans.some((s) => s.style.underline);
      const isRed = line.spans.some((s) => s.style.color === 'red');

      const isDoubleHeight = line.spans.some((s) => s.style.doubleHeight || s.style.scaleY > 1);
      const isDoubleWidth = line.spans.some((s) => s.style.doubleWidth || s.style.scaleX > 1);

      let fontSize = 36;
      if (isDoubleHeight && isDoubleWidth) fontSize = 58;
      else if (isDoubleHeight) fontSize = 48;
      else if (isDoubleWidth) fontSize = 42;

      currentY += fontSize * 0.85;

      if (line.spans.length > 0) {
        let totalLineWidth = 0;
        const measuredSpans = line.spans.map((span) => {
          const isSpanBold = span.style.bold || span.style.doubleWidth || span.style.scaleX > 1;
          const isSpanItalic = span.style.italic;
          const fontItalic = isSpanItalic ? 'italic ' : '';
          const fontWeight = isSpanBold ? '700 ' : '400 ';
          ctx.font = `${fontItalic}${fontWeight}${fontSize}px "Courier New", Courier, monospace`;
          const w = ctx.measureText(span.text).width;
          totalLineWidth += w;
          return { span, width: w, font: ctx.font };
        });

        let startX = marginPx;
        if (line.align === Alignment.CENTER) {
          startX = Math.max(marginPx, (canvasWidth - totalLineWidth) / 2);
        } else if (line.align === Alignment.RIGHT) {
          startX = Math.max(marginPx, canvasWidth - marginPx - totalLineWidth);
        }

        ctx.textAlign = 'left';
        let currentX = startX;

        measuredSpans.forEach(({ span, width: spanW, font }) => {
          ctx.font = font;
          if (span.style.reverse) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(currentX, currentY - fontSize * 0.82, spanW + 2, fontSize * 1.15);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(span.text, currentX + 1, currentY);
          } else if (span.style.color === 'red') {
            ctx.fillStyle = '#b91c1c';
            ctx.fillText(span.text, currentX, currentY);
          } else {
            ctx.fillStyle = '#000000';
            ctx.fillText(span.text, currentX, currentY);
          }
          currentX += spanW;
        });
      }

      if (isUnderline) {
        ctx.fillStyle = isRed ? '#b91c1c' : '#000000';
        ctx.fillRect(marginPx, currentY + 6, maxPrintableWidth, 3);
      }

      currentY += fontSize * 0.5;

      if (line.hasCutHere) {
        ctx.setLineDash([12, 10]);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(marginPx, currentY + 12);
        ctx.lineTo(canvasWidth - marginPx, currentY + 12);
        ctx.stroke();
        ctx.setLineDash([]);
        currentY += 45;
      }

      ctx.restore();
    });

    // Update Three.js Texture
    if (paperTextureRef.current) {
      paperTextureRef.current.needsUpdate = true;
    }
  };

  // Setup Three.js 3D Scene
  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const widthPx = container.clientWidth || 800;
    const heightPx = container.clientHeight || 600;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const studioBgColor = isBrightStudio ? 0xf1f5f9 : 0x181a20; // Crisp light slate vs dark studio
    scene.background = new THREE.Color(studioBgColor);

    // 2. Camera - Default to Macro Reading view
    const camera = new THREE.PerspectiveCamera(42, widthPx / heightPx, 0.1, 100);
    camera.position.set(0, 1.8, 2.7);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(widthPx, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.LinearToneMapping; // Preserves pure bright white thermal paper without dimming
    renderer.toneMappingExposure = 1.35;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // Don't go below floor
    controls.minDistance = 1.0;
    controls.maxDistance = 10;
    controls.target.set(0, 1.42, 0);
    controlsRef.current = controls;

    // 5. Bright Studio Lighting Setup
    // Sky/Ground hemisphere fill light
    const hemiLight = new THREE.HemisphereLight(0xffffff, isBrightStudio ? 0xcbcbcb : 0x444444, 2.8);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    // Dedicated Paper Front Spot Light (illuminates receipt text directly!)
    const paperFrontSpot = new THREE.DirectionalLight(0xffffff, 4.5);
    paperFrontSpot.position.set(0, 2.5, 4.8);
    scene.add(paperFrontSpot);

    // Main Studio Overhead Soft Light
    const mainKeyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    mainKeyLight.position.set(2, 6, 4);
    mainKeyLight.castShadow = true;
    mainKeyLight.shadow.mapSize.width = 2048;
    mainKeyLight.shadow.mapSize.height = 2048;
    mainKeyLight.shadow.bias = -0.0001;
    scene.add(mainKeyLight);

    // Soft rim cyan accent light
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
    rimLight.position.set(-4, 3, -3);
    scene.add(rimLight);

    // Warm Sunmi Orange ambient glow
    const frontBounceLight = new THREE.PointLight(0xff6b00, 2.0, 4);
    frontBounceLight.position.set(0, 0.8, 1.8);
    scene.add(frontBounceLight);

    // 6. Studio Ground Platform
    const groundGeo = new THREE.CircleGeometry(8, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: isBrightStudio ? 0xe2e8f0 : 0x222530,
      roughness: 0.6,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);
    groundMeshRef.current = ground;

    // Ground Grid helper ring
    const grid = new THREE.GridHelper(10, 30, 0xff6b00, isBrightStudio ? 0xc2c9d6 : 0x333745);
    grid.position.y = 0.001;
    scene.add(grid);

    // -------------------------------------------------------------
    // BUILD 3D SUNMI POS PRINTER MODEL (PROCEDURAL HIGH-DETAIL MESH)
    // -------------------------------------------------------------
    const printerGroup = new THREE.Group();

    // Material Definitions
    const darkBodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e2025,
      roughness: 0.35,
      metalness: 0.4,
    });

    const glossyCapMat = new THREE.MeshPhysicalMaterial({
      color: 0x111215,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.4, // Semi-transparent hatch window
      transparent: true,
      opacity: 0.9,
    });

    const sunmiOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xff5500, // Sunmi Brand Signature Orange
      roughness: 0.2,
      metalness: 0.1,
      emissive: 0xff3300,
      emissiveIntensity: 0.15,
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.1,
      metalness: 0.9,
    });

    const rubberFeetMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0c,
      roughness: 0.9,
    });

    // 1. Main Base Body Chassis
    const baseWidth = 1.6;
    const baseHeight = 1.1;
    const baseDepth = 2.2;

    const baseGeo = new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth);
    const baseMesh = new THREE.Mesh(baseGeo, darkBodyMat);
    baseMesh.position.y = baseHeight / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    printerGroup.add(baseMesh);

    // Rubber Feet
    const footGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16);
    [
      [-0.65, 0.03, -0.85],
      [0.65, 0.03, -0.85],
      [-0.65, 0.03, 0.85],
      [0.65, 0.03, 0.85],
    ].forEach(([fx, fy, fz]) => {
      const foot = new THREE.Mesh(footGeo, rubberFeetMat);
      foot.position.set(fx, fy, fz);
      printerGroup.add(foot);
    });

    // 2. Front Curved Bezel with Sunmi Orange Accent Line
    const frontAccentGeo = new THREE.BoxGeometry(baseWidth + 0.02, 0.08, 0.1);
    const frontAccent = new THREE.Mesh(frontAccentGeo, sunmiOrangeMat);
    frontAccent.position.set(0, 0.65, baseDepth / 2 + 0.02);
    frontAccent.castShadow = true;
    printerGroup.add(frontAccent);

    // Sunmi Logo Tag Badge
    const logoBadgeGeo = new THREE.BoxGeometry(0.5, 0.15, 0.02);
    const logoBadge = new THREE.Mesh(logoBadgeGeo, chromeMat);
    logoBadge.position.set(0, 0.45, baseDepth / 2 + 0.015);
    printerGroup.add(logoBadge);

    // 3. Status LED Light Ring & Power Button
    const ledGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 32);
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x10b981, // Emerald green standby LED
      emissive: 0x10b981,
      emissiveIntensity: 0.8,
    });
    const ledMesh = new THREE.Mesh(ledGeo, ledMat);
    ledMesh.rotation.x = Math.PI / 2;
    ledMesh.position.set(-0.5, 0.85, baseDepth / 2 + 0.015);
    printerGroup.add(ledMesh);
    ledMeshRef.current = ledMesh;

    const ledPointLight = new THREE.PointLight(0x10b981, 0.8, 1.2);
    ledPointLight.position.set(-0.5, 0.85, baseDepth / 2 + 0.1);
    printerGroup.add(ledPointLight);
    ledLightRef.current = ledPointLight;

    // Feed Button
    const feedBtnGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 32);
    const feedBtn = new THREE.Mesh(feedBtnGeo, darkBodyMat);
    feedBtn.rotation.x = Math.PI / 2;
    feedBtn.position.set(0.5, 0.85, baseDepth / 2 + 0.015);
    printerGroup.add(feedBtn);

    // 4. Top Paper Hatch Cover (Hinged Group)
    const hatchGroup = new THREE.Group();
    hatchGroup.position.set(0, baseHeight, -baseDepth / 2 + 0.2); // Pivot hinge at back

    const hatchGeo = new THREE.BoxGeometry(baseWidth - 0.08, 0.35, baseDepth - 0.3);
    const hatchMesh = new THREE.Mesh(hatchGeo, glossyCapMat);
    hatchMesh.position.set(0, 0.15, (baseDepth - 0.3) / 2);
    hatchMesh.castShadow = true;
    hatchGroup.add(hatchMesh);

    // Hatch Orange Open Handle / Latch
    const latchGeo = new THREE.BoxGeometry(0.3, 0.08, 0.08);
    const latchMesh = new THREE.Mesh(latchGeo, sunmiOrangeMat);
    latchMesh.position.set(0, 0.3, baseDepth - 0.4);
    hatchGroup.add(latchMesh);

    printerGroup.add(hatchGroup);
    topCoverRef.current = hatchGroup;

    // 5. Internal Thermal Paper Roll with Custom High-Detail Roll Canvas Texture
    const rollRadius = 0.42;
    const rollWidth = baseWidth - 0.25;

    const rollCanvas = document.createElement('canvas');
    rollCanvas.width = 512;
    rollCanvas.height = 256;
    const rollCtx = rollCanvas.getContext('2d');
    if (rollCtx) {
      rollCtx.fillStyle = '#fafaf5';
      rollCtx.fillRect(0, 0, 512, 256);

      // Paper roll wrapping seam lines
      rollCtx.fillStyle = '#d4d4cb';
      rollCtx.fillRect(0, 50, 512, 6);
      rollCtx.fillRect(0, 180, 512, 5);

      // Red end-of-roll warning stripe
      rollCtx.fillStyle = '#ef4444';
      rollCtx.fillRect(25, 0, 18, 256);

      // Sunmi Thermal Paper Branding on roll
      rollCtx.fillStyle = '#64748b';
      rollCtx.font = 'bold 22px sans-serif';
      rollCtx.fillText('SUNMI THERMAL • HIGH SENSITIVITY', 80, 135);
    }
    const rollTexture = new THREE.CanvasTexture(rollCanvas);
    rollTexture.wrapS = THREE.RepeatWrapping;
    rollTexture.wrapT = THREE.RepeatWrapping;

    const rollGeo = new THREE.CylinderGeometry(rollRadius, rollRadius, rollWidth, 32);
    const rollMat = new THREE.MeshStandardMaterial({
      map: rollTexture,
      roughness: 0.85,
    });
    const paperRoll = new THREE.Mesh(rollGeo, rollMat);
    paperRoll.rotation.z = Math.PI / 2;
    paperRoll.position.set(0, baseHeight - 0.1, 0.1);
    paperRoll.castShadow = true;
    printerGroup.add(paperRoll);
    paperRollRef.current = paperRoll;

    // Paper Core Cylinder (Dark plastic center tube)
    const coreGeo = new THREE.CylinderGeometry(0.1, 0.1, rollWidth + 0.02, 16);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.rotation.z = Math.PI / 2;
    coreMesh.position.set(0, baseHeight - 0.1, 0.1);
    printerGroup.add(coreMesh);

    // 6. Paper Exit Slot & Metallic Tear Cutter Blade Bar
    const slotX = 0;
    const slotY = baseHeight + 0.18;
    const slotZ = baseDepth / 2 - 0.25;

    const cutterBladeGeo = new THREE.BoxGeometry(baseWidth - 0.1, 0.04, 0.08);
    const cutterBlade = new THREE.Mesh(cutterBladeGeo, sunmiOrangeMat);
    cutterBlade.position.set(slotX, slotY, slotZ);
    cutterBlade.castShadow = true;
    printerGroup.add(cutterBlade);
    cutterBladeRef.current = cutterBlade;

    // 6b. Internal Chamber Paper Bridge Sheet (Connects roll directly to cutter exit slot)
    const paperWidth3D = width === '58mm' ? 1.25 : 1.45;
    const bridgeGeo = new THREE.PlaneGeometry(paperWidth3D, 0.8, 1, 16);
    const bridgePos = bridgeGeo.attributes.position;
    for (let i = 0; i < bridgePos.count; i++) {
      const yVal = bridgePos.getY(i);
      const t = (yVal + 0.4) / 0.8; // 0 at roll, 1 at slot
      const curZ = 0.1 + t * 0.75;
      const curY = 1.32 - t * 0.04 + Math.sin(t * Math.PI) * 0.05;
      bridgePos.setY(i, curY);
      bridgePos.setZ(i, curZ);
    }
    bridgeGeo.computeVertexNormals();

    const bridgeMat = new THREE.MeshStandardMaterial({
      color: 0xfafaf5,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const bridgeMesh = new THREE.Mesh(bridgeGeo, bridgeMat);
    printerGroup.add(bridgeMesh);

    // -------------------------------------------------------------
    // 7. DYNAMIC ANIMATED 3D THERMAL RECEIPT SHEET MESH
    // -------------------------------------------------------------
    // Create initial canvas texture for paper
    updateReceiptTexture();
    const paperCanvas = textureCanvasRef.current!;
    const paperTexture = new THREE.CanvasTexture(paperCanvas);
    paperTexture.colorSpace = THREE.SRGBColorSpace;
    paperTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    paperTexture.minFilter = THREE.LinearFilter;
    paperTexture.magFilter = THREE.LinearFilter;
    paperTextureRef.current = paperTexture;

    // Create curved paper plane geometry emerging from slot
    const initialPaperLength = 1.8;

    const paperMat = new THREE.MeshStandardMaterial({
      map: paperTexture,
      roughness: 0.8,
      metalness: 0.0,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: paperTexture,
      emissiveIntensity: 0.28, // Self-illuminates thermal paper so text is crisp and unshadowed!
      side: THREE.DoubleSide,
    });

    const paperGeo = new THREE.PlaneGeometry(paperWidth3D, initialPaperLength, 1, 32);

    // Gently curve paper geometry forward as it feeds out
    const pos = paperGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const yVal = pos.getY(i);
      // Curve lower/emerging part forward (+Z) and down (-Y)
      const normalizedY = (yVal + initialPaperLength / 2) / initialPaperLength;
      const forwardCurve = Math.sin(normalizedY * Math.PI * 0.7) * 0.25;
      pos.setZ(i, forwardCurve);
    }
    paperGeo.computeVertexNormals();

    const paperMesh = new THREE.Mesh(paperGeo, paperMat);
    // Position paper starting right at the printer slot
    paperMesh.position.set(slotX, slotY + initialPaperLength / 2, slotZ + 0.05);
    paperMesh.castShadow = true;
    paperMesh.receiveShadow = true;
    printerGroup.add(paperMesh);
    paperMeshRef.current = paperMesh;

    scene.add(printerGroup);

    // -------------------------------------------------------------
    // ANIMATION RENDER LOOP
    // -------------------------------------------------------------
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Gentle floating / idle ambient pulse on LED light when printing
      if (isPrinting) {
        if (ledMeshRef.current) {
          const pulse = (Math.sin(elapsedTime * 12) + 1) / 2;
          (ledMeshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + pulse * 0.8;
          (ledMeshRef.current.material as THREE.MeshStandardMaterial).color.setHex(0xf59e0b); // Amber pulse
        }
        if (ledLightRef.current) {
          ledLightRef.current.color.setHex(0xf59e0b);
        }

        // Rotate paper roll continuously inside chamber during print feed
        if (paperRollRef.current) {
          paperRollRef.current.rotation.x -= 0.05;
        }
      } else {
        if (ledMeshRef.current) {
          (ledMeshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8;
          (ledMeshRef.current.material as THREE.MeshStandardMaterial).color.setHex(0x10b981); // Emerald standby
        }
        if (ledLightRef.current) {
          ledLightRef.current.color.setHex(0x10b981);
        }
      }

      // Smooth hatch open / close animation
      if (topCoverRef.current) {
        const targetRotX = isHatchOpenRef.current ? -1.45 : 0; // ~83 deg wide open chamber
        topCoverRef.current.rotation.x += (targetRotX - topCoverRef.current.rotation.x) * 0.12;
      }

      // Animate falling cut papers under gravity & lay flat on studio floor
      for (let i = fallingPapersRef.current.length - 1; i >= 0; i--) {
        const item = fallingPapersRef.current[i];
        item.age += 0.016;

        if (!item.isLanded) {
          item.vy -= 0.0012; // gravity
          item.mesh.position.y += item.vy;
          item.mesh.position.z += item.vz;
          item.mesh.rotation.x += item.rotX;
          item.mesh.rotation.z += item.rotZ;

          // Check landing on studio ground
          if (item.mesh.position.y <= 0.02) {
            item.mesh.position.y = 0.025;
            item.mesh.position.x = 0;
            item.isLanded = true;

            const paperWidth3D = width === '58mm' ? 1.25 : 1.45;
            const canvas = textureCanvasRef.current;
            const aspect = canvas ? canvas.height / canvas.width : 1.2;
            const paperLength = paperWidth3D * aspect;
            // Position landed receipt completely in front of printer base (front bezel is at z = 1.12)
            const targetZ = 1.35 + paperLength / 2;
            item.mesh.position.z = targetZ;

            // Swap curved mesh for crisp flat PlaneGeometry lying flat on floor
            const flatGeo = new THREE.PlaneGeometry(paperWidth3D, paperLength, 1, 1);
            item.mesh.geometry.dispose();
            item.mesh.geometry = flatGeo;
            item.mesh.rotation.set(-Math.PI / 2, 0, 0);
          }
        } else {
          // Resting landed receipt on ground - readable & viewable for 600 seconds (10 minutes)
          if (item.age > 600.0) {
            item.opacity -= 0.003;
            item.material.opacity = Math.max(0, item.opacity);
          }
        }

        if (item.opacity <= 0 || item.mesh.position.y < -2.0) {
          if (sceneRef.current) {
            sceneRef.current.remove(item.mesh);
          }
          item.mesh.geometry.dispose();
          item.material.dispose();
          fallingPapersRef.current.splice(i, 1);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Responsive Container Sizing & Resize Observer
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth || 800;
      const h = mountRef.current.clientHeight || 600;
      if (w > 0 && h > 0) {
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
      }
    };

    // Render immediate frame 0 synchronously
    handleResize();
    renderer.render(scene, camera);

    // Continuous resize observer for container expansion/flexbox settling
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();

      // Clean up falling paper meshes
      fallingPapersRef.current.forEach((item) => {
        if (sceneRef.current) sceneRef.current.remove(item.mesh);
        item.mesh.geometry.dispose();
        item.material.dispose();
      });
      fallingPapersRef.current = [];

      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
      }
    };
  }, [width]);

  // Update receipt paper texture and length as printed lines advance
  useEffect(() => {
    // If starting a fresh print sequence from line 0, reset paper cut state & clear old landed papers
    if (printedLineCount === 0) {
      isPaperCutRef.current = false;
      lastCutLineIndexRef.current = -1;
      fallingPapersRef.current.forEach((item) => {
        if (sceneRef.current) sceneRef.current.remove(item.mesh);
        item.mesh.geometry.dispose();
        item.material.dispose();
      });
      fallingPapersRef.current = [];
    }

    updateReceiptTexture();

    // Scale paper mesh length dynamically with printed content ONLY if not cut
    if (paperMeshRef.current && !isPaperCutRef.current && textureCanvasRef.current) {
      const paperWidth3D = width === '58mm' ? 1.25 : 1.45;
      const canvas = textureCanvasRef.current;
      const aspect = canvas.height / canvas.width;
      const targetPaperLength = Math.max(0.35, paperWidth3D * aspect);

      // Re-curve geometry for new length
      const newGeo = new THREE.PlaneGeometry(paperWidth3D, targetPaperLength, 1, 32);
      const pos = newGeo.attributes.position;

      for (let i = 0; i < pos.count; i++) {
        const yVal = pos.getY(i);
        const normalizedY = (yVal + targetPaperLength / 2) / targetPaperLength;
        const forwardCurve = Math.sin(normalizedY * Math.PI * 0.65) * 0.35 * Math.min(1.5, targetPaperLength / 2);
        pos.setZ(i, forwardCurve);
      }
      newGeo.computeVertexNormals();

      paperMeshRef.current.geometry.dispose();
      paperMeshRef.current.geometry = newGeo;

      const baseHeight = 1.1;
      const baseDepth = 2.2;
      const slotY = baseHeight + 0.18;
      const slotZ = baseDepth / 2 - 0.25;

      paperMeshRef.current.position.set(0, slotY + targetPaperLength / 2, slotZ + 0.05);
    }
  }, [printedLineCount, data.lines, width]);

  // Execute 3D Physical Paper Cut Operation
  const execute3DCut = () => {
    if (!sceneRef.current || !paperMeshRef.current || !textureCanvasRef.current) return;

    // 1. Animate cutter blade slide and glow
    if (cutterBladeRef.current) {
      let startTime = performance.now();
      const duration = 450;
      const animateBlade = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);

        if (cutterBladeRef.current) {
          const slideOffset = Math.sin(progress * Math.PI) * 0.7;
          cutterBladeRef.current.position.x = slideOffset;
          (cutterBladeRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
            0.2 + Math.sin(progress * Math.PI) * 2.2;
        }

        if (progress < 1) {
          requestAnimationFrame(animateBlade);
        } else if (cutterBladeRef.current) {
          cutterBladeRef.current.position.x = 0;
          (cutterBladeRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
        }
      };
      animateBlade();
    }

    // 2. Clone current printed receipt paper mesh to create a detached falling cut slip
    const sourceMesh = paperMeshRef.current;
    const cutGeo = sourceMesh.geometry.clone();

    // Copy current canvas texture for the severed sheet
    const sourceCanvas = textureCanvasRef.current;
    const cutCanvas = document.createElement('canvas');
    cutCanvas.width = sourceCanvas.width;
    cutCanvas.height = sourceCanvas.height;
    const cutCtx = cutCanvas.getContext('2d');
    if (cutCtx) {
      cutCtx.drawImage(sourceCanvas, 0, 0);
    }

    const cutTexture = new THREE.CanvasTexture(cutCanvas);
    cutTexture.colorSpace = THREE.SRGBColorSpace;

    const cutMat = new THREE.MeshStandardMaterial({
      map: cutTexture,
      roughness: 0.8,
      metalness: 0.0,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: cutTexture,
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0,
    });

    const cutMesh = new THREE.Mesh(cutGeo, cutMat);
    cutMesh.position.copy(sourceMesh.position);
    cutMesh.rotation.copy(sourceMesh.rotation);
    cutMesh.castShadow = true;

    sceneRef.current.add(cutMesh);

    fallingPapersRef.current.push({
      mesh: cutMesh,
      material: cutMat,
      vy: 0.012, // initial upward pop
      vz: 0.025, // float forward
      rotX: 0.02,
      rotZ: (Math.random() - 0.5) * 0.04,
      opacity: 1.0,
      age: 0,
    });

    // 3. Shorten remaining paper on printer slot to a fresh short stub
    const paperWidth3D = width === '58mm' ? 1.25 : 1.45;
    const stubLength = 0.25;
    const stubGeo = new THREE.PlaneGeometry(paperWidth3D, stubLength, 1, 16);
    const pos = stubGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const yVal = pos.getY(i);
      const normalizedY = (yVal + stubLength / 2) / stubLength;
      pos.setZ(i, Math.sin(normalizedY * Math.PI * 0.5) * 0.05);
    }
    stubGeo.computeVertexNormals();

    sourceMesh.geometry.dispose();
    sourceMesh.geometry = stubGeo;

    const baseHeight = 1.1;
    const baseDepth = 2.2;
    const slotY = baseHeight + 0.18;
    const slotZ = baseDepth / 2 - 0.25;

    sourceMesh.position.set(0, slotY + stubLength / 2, slotZ + 0.05);

    // Set cut line index so next printed lines start on a new feed
    lastCutLineIndexRef.current = Math.max(0, printedLineCount - 1);
    isPaperCutRef.current = false;

    // Call external trigger cut callback if provided
    if (onTriggerCut) {
      onTriggerCut();
    }
  };

  // Trigger Cutter Blade Animation from parent prop change
  useEffect(() => {
    if (activeCutAnimation) {
      execute3DCut();
    }
  }, [activeCutAnimation]);

  // Inspect Paper Roll Chamber Toggle (opens hatch wide & zooms camera inside)
  const toggleInspectRoll = () => {
    const nextHatchState = !isHatchOpen;
    setIsHatchOpen(nextHatchState);

    if (nextHatchState) {
      // Open hatch and zoom camera directly into paper roll chamber
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.set(0, 3.8, 1.8);
        controlsRef.current.target.set(0, 1.1, 0.1);
        controlsRef.current.update();
        setCameraPreset('top');
      }
    } else {
      // Return to macro read view on close
      setCameraView('macro');
    }
  };

  // Trigger external camera preset change when requested by parent
  useEffect(() => {
    if (requestedCameraPreset) {
      setCameraView(requestedCameraPreset);
    }
  }, [requestedCameraPreset]);

  // Camera Presets
  const setCameraView = (view: 'macro' | '3/4' | 'front' | 'top' | 'floor') => {
    setCameraPreset(view);
    if (!cameraRef.current || !controlsRef.current) return;

    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    if (view === 'macro') {
      // Zoomed macro view framing printed receipt paper directly
      cam.position.set(0, 1.8, 2.7);
      ctrl.target.set(0, 1.45, 0);
    } else if (view === '3/4') {
      // Classic 3D perspective angle showing full printer body
      cam.position.set(2.2, 2.8, 3.8);
      ctrl.target.set(0, 0.9, 0);
    } else if (view === 'front') {
      // Direct front view
      cam.position.set(0, 1.6, 3.8);
      ctrl.target.set(0, 1.2, 0);
    } else if (view === 'top') {
      // Overhead top slot view
      cam.position.set(0, 5.2, 0.2);
      ctrl.target.set(0, 0.5, 0);
    } else if (view === 'floor') {
      // Direct high-resolution zoomed view framing the cut receipt landed flat on the studio floor
      if (fallingPapersRef.current.length === 0 && !isPaperCutRef.current) {
        execute3DCut();
      }

      const paperWidth3D = width === '58mm' ? 1.25 : 1.45;
      const canvas = textureCanvasRef.current;
      const aspect = canvas ? canvas.height / canvas.width : 1.2;
      const paperLength = paperWidth3D * aspect;
      const targetZ = 1.35 + paperLength / 2;

      // Close, crystal-clear reading camera angle focused directly on floor receipt
      cam.position.set(0, 1.3 + paperLength * 0.22, targetZ + 0.45 + paperLength * 0.28);
      ctrl.target.set(0, 0.025, targetZ);
    }
    ctrl.update();
  };

  return (
    <div className="w-full h-full relative flex flex-col bg-neutral-950 overflow-hidden select-none">
      {/* 3D WebGL Canvas Render Stage */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Well-Organized Floating Top Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left Toolbar Controls Group */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* 1. Camera Angle Presets Group */}
          <div className="flex items-center bg-neutral-900/90 backdrop-blur-md p-1 rounded-xl border border-neutral-800 shadow-xl">
            <span className="px-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider hidden lg:inline">Camera:</span>
            <button
              onClick={() => setCameraView('macro')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                cameraPreset === 'macro'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
              title="Zoom in to read printed receipt text"
            >
              <Maximize2 size={13} />
              <span>Printer Slot</span>
            </button>
            <button
              onClick={() => setCameraView('floor')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                cameraPreset === 'floor'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
              title="Zoom down to view receipt landed flat on floor"
            >
              <FileText size={13} />
              <span>Landed Receipt</span>
            </button>
            <button
              onClick={() => setCameraView('3/4')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                cameraPreset === '3/4'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
              title="Isometric 3D perspective angle"
            >
              <Eye size={13} />
              <span>3D Angle</span>
            </button>
            <button
              onClick={() => setCameraView('front')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                cameraPreset === 'front'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
              title="Frontal view"
            >
              <span>Front</span>
            </button>
            <button
              onClick={() => setCameraView('top')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                cameraPreset === 'top'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
              title="Top slot view"
            >
              <span>Top Feed</span>
            </button>
          </div>

          {/* 2. Interactive Printer Operations Group */}
          <div className="flex items-center bg-neutral-900/90 backdrop-blur-md p-1 rounded-xl border border-neutral-800 shadow-xl gap-1">
            {/* Inspect Paper Roll Chamber Button */}
            <button
              onClick={toggleInspectRoll}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 border ${
                isHatchOpen
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800 border-transparent'
              }`}
              title={isHatchOpen ? 'Close printer chamber lid' : 'Open hatch and zoom camera to inspect paper roll'}
            >
              <Layers size={13} className={isHatchOpen ? 'text-amber-400 animate-pulse' : 'text-neutral-400'} />
              <span>{isHatchOpen ? 'Close Chamber' : 'Inspect Paper Roll'}</span>
            </button>

            {/* Cut Paper Button */}
            <button
              onClick={execute3DCut}
              className="px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-all flex items-center gap-1.5 border border-neutral-700/80 active:scale-95"
              title="Cut paper sheet at cutter blade in 3D"
            >
              <Scissors size={13} className="text-amber-400" />
              <span>Cut Paper</span>
            </button>
          </div>
        </div>

        {/* Right Toolbar Controls Group: Live Status */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-neutral-800 text-xs font-mono shadow-xl">
            <span className={`w-2.5 h-2.5 rounded-full ${isPrinting ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
            <span className="text-neutral-200 font-bold uppercase tracking-wider hidden sm:inline">Sunmi POS 3D</span>
          </div>
        </div>
      </div>

      {/* Bottom Center Reset View & Instruction Bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-neutral-900/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-neutral-800/90 shadow-2xl">
        <span className="text-[11px] text-neutral-400 font-mono hidden md:inline">
          💡 Drag to rotate 3D Sunmi Printer • Scroll to zoom • Right-click drag to pan
        </span>

        <button
          onClick={() => setCameraView('macro')}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-semibold border border-neutral-700 transition-all"
          title="Reset camera view to read receipt"
        >
          <RotateCcw size={13} />
          <span>Reset Camera</span>
        </button>
      </div>
    </div>
  );
};
