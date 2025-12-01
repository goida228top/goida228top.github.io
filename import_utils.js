
import planck from './planck.js';
import { PHYSICS_SCALE } from './game_config.js';

// ==========================================
// МАТЕМАТИКА И УТИЛИТЫ
// ==========================================

class Matrix {
    constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
        this.a = a; this.b = b;
        this.c = c; this.d = d;
        this.e = e; this.f = f;
    }

    multiply(m) {
        return new Matrix(
            this.a * m.a + this.c * m.b,
            this.b * m.a + this.d * m.b,
            this.a * m.c + this.c * m.d,
            this.b * m.c + this.d * m.d,
            this.a * m.e + this.c * m.f + this.e,
            this.b * m.e + this.d * m.f + this.f
        );
    }

    transformPoint(x, y) {
        return {
            x: this.a * x + this.c * y + this.e,
            y: this.b * x + this.d * y + this.f
        };
    }

    getScale() {
        return Math.sqrt(this.a * this.a + this.b * this.b);
    }

    getRotation() {
        return Math.atan2(this.b, this.a);
    }

    static translate(x, y) {
        return new Matrix(1, 0, 0, 1, x, y);
    }

    static rotate(angleDeg) {
        const rad = angleDeg * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return new Matrix(cos, sin, -sin, cos, 0, 0);
    }
    
    static fromString(transformStr) {
        let m = new Matrix();
        if (!transformStr) return m;
        const regex = /(\w+)\s*\(([^)]*)\)/g;
        let match;
        while ((match = regex.exec(transformStr)) !== null) {
            const type = match[1];
            const args = match[2].split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
            
            if (type === 'translate') {
                m = m.multiply(Matrix.translate(args[0], args[1] || 0));
            } else if (type === 'rotate') {
                if (args.length === 3) {
                    m = m.multiply(Matrix.translate(args[1], args[2]));
                    m = m.multiply(Matrix.rotate(args[0]));
                    m = m.multiply(Matrix.translate(-args[1], -args[2]));
                } else {
                    m = m.multiply(Matrix.rotate(args[0]));
                }
            } else if (type === 'scale') {
                 const sx = args[0];
                 const sy = args[1] !== undefined ? args[1] : sx;
                 const sm = new Matrix(sx, 0, 0, sy, 0, 0);
                 m = m.multiply(sm);
            } else if (type === 'matrix' && args.length === 6) {
                m = m.multiply(new Matrix(args[0], args[1], args[2], args[3], args[4], args[5]));
            }
        }
        return m;
    }
}

function calculateCentroid(vertices) {
    let x = 0, y = 0;
    if (vertices.length === 0) return { x: 0, y: 0 };
    for (let i = 0; i < vertices.length; i++) {
        x += vertices[i].x;
        y += vertices[i].y;
    }
    return { x: x / vertices.length, y: y / vertices.length };
}

function getSignedArea(vertices) {
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
        const j = (i + 1) % vertices.length;
        area += (vertices[j].x - vertices[i].x) * (vertices[j].y + vertices[i].y);
    }
    return area / 2;
}

function ensureCCW(vertices) {
    if (vertices.length < 3) return vertices;
    const area = getSignedArea(vertices);
    if (area > 0) { 
        return [...vertices].reverse();
    }
    return vertices;
}

function getPolygonBounds(vertices) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    vertices.forEach(v => {
        minX = Math.min(minX, v.x);
        maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y);
        maxY = Math.max(maxY, v.y);
    });
    return { minX, maxX, minY, maxY };
}

function simplifyVertices(vertices, minDistance = 2) {
    if (vertices.length < 3) return vertices;
    const result = [vertices[0]];
    for (let i = 1; i < vertices.length; i++) {
        const prev = result[result.length - 1];
        const curr = vertices[i];
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        if (dx * dx + dy * dy > minDistance * minDistance) {
            result.push(curr);
        }
    }
    const first = result[0];
    const last = result[result.length - 1];
    const dx = first.x - last.x;
    const dy = first.y - last.y;
    if (dx * dx + dy * dy < minDistance * minDistance && result.length > 3) {
        result.pop();
    }
    return result;
}

// ==========================================
// ПАРСЕР ПУТЕЙ
// ==========================================

function cubicPoint(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;
    return {
        x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
        y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
    };
}

function quadraticPoint(p0, p1, p2, t) {
    const mt = 1 - t;
    return {
        x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
        y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
    };
}

function parsePathData(d) {
    const tokens = d.match(/([a-zA-Z]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g);
    if (!tokens) return [];

    const subPaths = [];
    let currentPath = [];
    let cx = 0, cy = 0; 
    let sx = 0, sy = 0; 
    let px = 0, py = 0; 

    let i = 0;
    while (i < tokens.length) {
        const token = tokens[i];
        
        if (/^[a-zA-Z]$/.test(token)) {
            const cmd = token;
            const upperCmd = cmd.toUpperCase();
            i++;
            
            const nextNum = () => {
                const val = parseFloat(tokens[i++]);
                return isNaN(val) ? 0 : val;
            };

            if (upperCmd === 'M') {
                if (currentPath.length > 0) {
                    subPaths.push(currentPath);
                    currentPath = [];
                }
                cx = nextNum(); cy = nextNum();
                sx = cx; sy = cy;
                currentPath.push({x: cx, y: cy});
                px = cx; py = cy;

                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    const nx = nextNum(); const ny = nextNum();
                    if (cmd === 'm') { cx += nx; cy += ny; } else { cx = nx; cy = ny; }
                    currentPath.push({x: cx, y: cy});
                    px = cx; py = cy;
                }
            }
            else if (upperCmd === 'L') {
                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    const nx = nextNum(); const ny = nextNum();
                    if (cmd === 'l') { cx += nx; cy += ny; } else { cx = nx; cy = ny; }
                    currentPath.push({x: cx, y: cy});
                    px = cx; py = cy;
                }
            }
            else if (upperCmd === 'H') {
                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    const nx = nextNum();
                    if (cmd === 'h') { cx += nx; } else { cx = nx; }
                    currentPath.push({x: cx, y: cy});
                    px = cx; py = cy;
                }
            }
            else if (upperCmd === 'V') {
                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    const ny = nextNum();
                    if (cmd === 'v') { cy += ny; } else { cy = ny; }
                    currentPath.push({x: cx, y: cy});
                    px = cx; py = cy;
                }
            }
            else if (upperCmd === 'C') {
                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    let x1 = nextNum(), y1 = nextNum(), x2 = nextNum(), y2 = nextNum(), x = nextNum(), y = nextNum();
                    if (cmd === 'c') { x1+=cx; y1+=cy; x2+=cx; y2+=cy; x+=cx; y+=cy; }
                    
                    const steps = 4; 
                    for(let t=1; t<=steps; t++) {
                        currentPath.push(cubicPoint({x:cx,y:cy}, {x:x1,y:y1}, {x:x2,y:y2}, {x:x,y:y}, t/steps));
                    }
                    cx = x; cy = y; px = x2; py = y2;
                }
            }
            else if (upperCmd === 'Q') {
                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    let x1 = nextNum(), y1 = nextNum(), x = nextNum(), y = nextNum();
                    if (cmd === 'q') { x1+=cx; y1+=cy; x+=cx; y+=cy; }
                    
                    const steps = 4;
                    for(let t=1; t<=steps; t++) {
                        currentPath.push(quadraticPoint({x:cx,y:cy}, {x:x1,y:y1}, {x:x,y:y}, t/steps));
                    }
                    cx = x; cy = y; px = x1; py = y1;
                }
            }
            else if (upperCmd === 'Z') {
                if (currentPath.length > 0) {
                     const last = currentPath[currentPath.length-1];
                     const dist = Math.hypot(last.x - sx, last.y - sy);
                     if(dist > 1) currentPath.push({x:sx, y:sy});
                }
                cx = sx; cy = sy;
            }
        } else {
            i++;
        }
    }
    if (currentPath.length > 0) subPaths.push(currentPath);
    return subPaths;
}

// ==========================================
// СОЗДАНИЕ ТЕЛ (ФИЗИКА)
// ==========================================

function getVisibleColor(node) {
    const getStyle = (name) => node.getAttribute(name) || node.style[name];
    let fill = getStyle('fill');
    let stroke = getStyle('stroke');
    
    if (fill && fill !== 'none') return fill;
    if (stroke && stroke !== 'none') return stroke;
    
    return '#888888';
}

// Глобальный счетчик для уникальных групп импорта. Начинаем с большого отрицательного числа.
let nextGroupIndex = -100;

function createBodyFromShapeData(world, shape, spawnPos, groupIndex = 0) {
    if (!spawnPos) spawnPos = { x: 0, y: 0 };

    const worldX = spawnPos.x + (shape.x || 0);
    const worldY = spawnPos.y + (shape.y || 0);

    if (!isFinite(worldX) || !isFinite(worldY)) return null;

    let centroid = { x: 0, y: 0 };
    let localVertices = null;

    if (shape.type === 'polygon') {
        const simplified = simplifyVertices(shape.vertices);
        if (simplified.length < 3) return null;
        
        centroid = calculateCentroid(simplified);
        localVertices = simplified.map(v => ({
            x: v.x - centroid.x,
            y: v.y - centroid.y
        }));
        localVertices = ensureCCW(localVertices);
    }

    const bodyPos = planck.Vec2(worldX + centroid.x, worldY + centroid.y);
    
    const body = world.createBody({
        type: 'dynamic', 
        position: bodyPos,
        angle: shape.angle || 0,
        userData: {
            label: 'imported',
            render: { fillStyle: shape.color || '#cccccc' }
        }
    });

    try {
        const fixtureDef = {
            density: 1, 
            friction: 0.3, 
            restitution: 0.2,
            filterGroupIndex: groupIndex // Важно: отрицательный индекс предотвращает коллизии внутри группы
        };

        if (shape.type === 'box') {
            if (shape.width <= 0 || shape.height <= 0) throw new Error("Invalid dimensions");
            body.createFixture(planck.Box(shape.width / 2, shape.height / 2), fixtureDef);
        } 
        else if (shape.type === 'circle') {
             if (shape.radius <= 0) throw new Error("Invalid radius");
            body.createFixture(planck.Circle(shape.radius), fixtureDef);
        }
        else if (shape.type === 'polygon' && localVertices) {
            const maxVerts = 8;
            let finalVerts = localVertices;
            
            if (finalVerts.length > maxVerts) {
                 const step = Math.ceil(finalVerts.length / maxVerts);
                 finalVerts = finalVerts.filter((_, i) => i % step === 0);
            }
            
            if (finalVerts.length >= 3) {
                const vecVerts = finalVerts.map(v => planck.Vec2(v.x, v.y));
                body.createFixture(planck.Polygon(vecVerts), fixtureDef);
            } else {
                throw new Error("Not enough vertices");
            }
        }
    } catch (e) {
        console.warn("Error creating fixture:", e.message);
        world.destroyBody(body);
        return null;
    }
    
    body.setAwake(true);
    return body;
}

// ==========================================
// ОСНОВНЫЕ ФУНКЦИИ ЭКСПОРТА
// ==========================================

export function loadFromJSON(world, jsonString, spawnPos) {
    try {
        const shapes = JSON.parse(jsonString);
        if (!Array.isArray(shapes)) return false;
        
        let count = 0;
        shapes.forEach(s => {
            // JSON загрузка не использует группировку для сварки, объекты независимы
            if (createBodyFromShapeData(world, s, spawnPos, 0)) count++;
        });
        return count > 0;
    } catch (e) {
        console.error("JSON Load Error", e);
        return false;
    }
}

export function loadFromSVG(world, svgString, spawnPos) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, "image/svg+xml");
        const svgRoot = doc.documentElement;
        if (!svgRoot || svgRoot.tagName !== 'svg') {
            console.error("Invalid SVG content");
            return false;
        }

        const shapes = [];

        function processNode(node, currentMatrix) {
            let matrix = currentMatrix;
            const tf = node.getAttribute ? node.getAttribute('transform') : null;
            if (tf) matrix = currentMatrix.multiply(Matrix.fromString(tf));
            
            const tag = node.tagName;
            if (tag === 'defs' || tag === 'clipPath') return;

            const getF = (n, d=0) => parseFloat(node.getAttribute(n)) || d;
            const color = getVisibleColor(node);

            if (node.getAttribute && node.getAttribute('display') === 'none') return;

            if (tag === 'g' || tag === 'svg') {
                for (let child of node.children) processNode(child, matrix);
            }
            else if (tag === 'rect') {
                const w = getF('width'); const h = getF('height');
                if (w > 0 && h > 0) {
                    const x = getF('x'); const y = getF('y');
                    const p = matrix.transformPoint(x + w/2, y + h/2);
                    const scale = matrix.getScale();
                    shapes.push({
                        type: 'box',
                        x: p.x / PHYSICS_SCALE,
                        y: p.y / PHYSICS_SCALE,
                        width: (w * scale) / PHYSICS_SCALE,
                        height: (h * scale) / PHYSICS_SCALE,
                        angle: matrix.getRotation(),
                        color: color
                    });
                }
            }
            else if (tag === 'circle') {
                const r = getF('r');
                if (r > 0) {
                    const cx = getF('cx'); const cy = getF('cy'); 
                    const p = matrix.transformPoint(cx, cy);
                    shapes.push({
                        type: 'circle',
                        x: p.x / PHYSICS_SCALE,
                        y: p.y / PHYSICS_SCALE,
                        radius: (r * matrix.getScale()) / PHYSICS_SCALE,
                        color: color
                    });
                }
            }
            else if (tag === 'path') {
                const d = node.getAttribute('d');
                if (d) {
                    const subPaths = parsePathData(d);
                    subPaths.forEach(path => {
                        const worldVerts = path.map(v => {
                            const wp = matrix.transformPoint(v.x, v.y);
                            return { x: wp.x / PHYSICS_SCALE, y: wp.y / PHYSICS_SCALE };
                        });
                        if (worldVerts.length > 2) {
                            shapes.push({
                                type: 'polygon',
                                vertices: worldVerts,
                                color: color
                            });
                        }
                    });
                }
            }
            else if (tag === 'polygon' || tag === 'polyline') {
                 const pointsStr = node.getAttribute('points');
                 if (pointsStr) {
                     const points = pointsStr.trim().split(/[\s,]+/).map(parseFloat);
                     const verts = [];
                     for(let i=0; i<points.length; i+=2) {
                         if (!isNaN(points[i]) && !isNaN(points[i+1])) {
                            const wp = matrix.transformPoint(points[i], points[i+1]);
                            verts.push({ x: wp.x / PHYSICS_SCALE, y: wp.y / PHYSICS_SCALE });
                         }
                     }
                     if (verts.length > 2) {
                        shapes.push({
                            type: 'polygon',
                            vertices: verts,
                            color: color
                        });
                     }
                 }
            }
        }

        processNode(svgRoot, new Matrix());

        if (shapes.length > 0) {
            // Вычисляем границы ВСЕЙ группы для центрирования
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            
            shapes.forEach(s => {
                let sMinX, sMaxX, sMinY, sMaxY;
                if (s.type === 'box') {
                    sMinX = s.x - s.width/2; sMaxX = s.x + s.width/2;
                    sMinY = s.y - s.height/2; sMaxY = s.y + s.height/2;
                } else if (s.type === 'circle') {
                    sMinX = s.x - s.radius; sMaxX = s.x + s.radius;
                    sMinY = s.y - s.radius; sMaxY = s.y + s.radius;
                } else if (s.type === 'polygon') {
                    const b = getPolygonBounds(s.vertices);
                    sMinX = b.minX; sMaxX = b.maxX;
                    sMinY = b.minY; sMaxY = b.maxY;
                }
                if (sMinX !== undefined && isFinite(sMinX)) {
                    minX = Math.min(minX, sMinX); maxX = Math.max(maxX, sMaxX);
                    minY = Math.min(minY, sMinY); maxY = Math.max(maxY, sMaxY);
                }
            });

            if (!isFinite(minX) || !isFinite(minY)) return false;

            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;
            
            // Генерируем уникальный отрицательный индекс группы для этого импорта
            const currentGroupIndex = --nextGroupIndex;
            const createdBodies = [];

            shapes.forEach(s => {
                // Смещаем координаты относительно центра группы
                if (s.vertices) {
                    s.vertices = s.vertices.map(v => ({x: v.x - cx, y: v.y - cy}));
                } else {
                    s.x -= cx;
                    s.y -= cy;
                }
                
                const body = createBodyFromShapeData(world, s, spawnPos, currentGroupIndex);
                if (body) createdBodies.push(body);
            });
            
            // ЖЕСТКАЯ СВЯЗКА (WELD): Соединяем все части в единую структуру
            if (createdBodies.length > 1) {
                const rootBody = createdBodies[0];
                for (let i = 1; i < createdBodies.length; i++) {
                    const partBody = createdBodies[i];
                    // Свариваем каждое тело с первым телом (rootBody)
                    world.createJoint(planck.WeldJoint({
                        bodyA: rootBody,
                        bodyB: partBody,
                        // Якорь на центре дочернего тела. Box2D зафиксирует текущее относительное положение.
                        localAnchorA: rootBody.getLocalPoint(partBody.getPosition()),
                        localAnchorB: planck.Vec2(0, 0),
                        referenceAngle: partBody.getAngle() - rootBody.getAngle()
                    }));
                }
            }
            
            return createdBodies.length > 0;
        }
        return false;
    } catch (e) {
        console.error("SVG Parsing Error:", e);
        return false;
    }
}
