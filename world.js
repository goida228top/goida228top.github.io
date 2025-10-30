import Matter from 'matter-js';

const { World, Bodies } = Matter;

let boundaries = [];

// Фиксированная мировая координата для поверхности земли
const GROUND_Y = 1000; 

export function setupWorld(world, viewportHeight) {
    if (boundaries.length > 0) {
        World.remove(world, boundaries);
    }
    
    const WORLD_WIDTH = 8000;
    const WORLD_HEIGHT = 4000;
    const WALL_THICKNESS = 500;

    // Сохраняем позицию земли для доступа из других модулей (например, камеры)
    localStorage.setItem('ground_y', GROUND_Y.toString());

    boundaries = [
         // Земля - теперь ее позиция идеальна
         Bodies.rectangle(
             0, // Центр мира по X
             GROUND_Y + WALL_THICKNESS / 2, // Позиция Y под видимой линией
             WORLD_WIDTH, 
             WALL_THICKNESS, 
             { isStatic: true, render: { visible: false }, label: 'boundary' }
         ),
         // Левая стена
         Bodies.rectangle(
             -WORLD_WIDTH / 2, 
             GROUND_Y - WORLD_HEIGHT / 2, 
             WALL_THICKNESS, 
             WORLD_HEIGHT * 2, 
             { isStatic: true, render: { visible: false }, label: 'boundary' }
         ),
         // Правая стена
         Bodies.rectangle(
             WORLD_WIDTH / 2, 
             GROUND_Y - WORLD_HEIGHT / 2, 
             WALL_THICKNESS, 
             WORLD_HEIGHT * 2, 
             { isStatic: true, render: { visible: false }, label: 'boundary' }
         )
    ];
    World.add(world, boundaries);
    
    return { GROUND_Y };
}