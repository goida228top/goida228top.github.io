import planck from './planck.js';
import { 
    PHYSICS_SCALE,
    GROUND_Y, 
    WORLD_LEFT_X, 
    WORLD_RIGHT_X, 
    WORLD_WIDTH, 
    WORLD_TOP_Y, 
    GRASS_HEIGHT, 
    DIRT_HEIGHT, 
    STONE_HEIGHT 
} from './game_config.js';

let boundaries = [];

// Константы расположения мира и слоев фона теперь импортируются из game_config.js


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
    
    return { 
        GROUND_Y,
        groundBody: ground // Возвращаем тело земли для моторов
    };
}