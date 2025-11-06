import planck from './planck.js';
import { PHYSICS_SCALE } from './config.js';

let boundaries = [];

// --- Константы расположения мира в ПИКСЕЛЯХ ---
export const GROUND_Y = 1000; 
export const WORLD_LEFT_X = -4000;
export const WORLD_RIGHT_X = 8000;
export const WORLD_WIDTH = WORLD_RIGHT_X - WORLD_LEFT_X;
export const WORLD_TOP_Y = -3000;

// --- Константы слоев фона в ПИКСЕЛЯХ ---
export const GRASS_HEIGHT = 20;
export const DIRT_HEIGHT = 150;
export const STONE_HEIGHT = DIRT_HEIGHT * 2;
export const WORLD_BOTTOM_Y = GROUND_Y + GRASS_HEIGHT + DIRT_HEIGHT + STONE_HEIGHT;


export function setupWorld(world, viewportHeight) {
    if (boundaries.length > 0) {
        boundaries.forEach(body => {
            if (body.getWorld() === world) {
                world.destroyBody(body);
            }
        });
        boundaries = [];
    }
    
    const ground = world.createBody({
        userData: {
            label: 'boundary',
            render: { visible: false }
        }
    });

    const toMeters = (v) => v / PHYSICS_SCALE;

    // Пол
    ground.createFixture(planck.Edge(
        planck.Vec2(toMeters(WORLD_LEFT_X), toMeters(GROUND_Y)), 
        planck.Vec2(toMeters(WORLD_RIGHT_X), toMeters(GROUND_Y))
    ));
    // Потолок
    ground.createFixture(planck.Edge(
        planck.Vec2(toMeters(WORLD_LEFT_X), toMeters(WORLD_TOP_Y)), 
        planck.Vec2(toMeters(WORLD_RIGHT_X), toMeters(WORLD_TOP_Y))
    ));
    // Стены
    ground.createFixture(planck.Edge(
        planck.Vec2(toMeters(WORLD_LEFT_X), toMeters(WORLD_TOP_Y)), 
        planck.Vec2(toMeters(WORLD_LEFT_X), toMeters(GROUND_Y))
    ));
    ground.createFixture(planck.Edge(
        planck.Vec2(toMeters(WORLD_RIGHT_X), toMeters(WORLD_TOP_Y)), 
        planck.Vec2(toMeters(WORLD_RIGHT_X), toMeters(GROUND_Y))
    ));
    
    boundaries.push(ground);
    
    return { GROUND_Y };
}
