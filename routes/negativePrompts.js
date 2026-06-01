const negativePrompts = {
  global: `empty room, luxury hotel, dark furniture, black furniture, industrial style, overdecorated, oversized furniture, tiny furniture, floating furniture, unrealistic proportions, excessive accessories, visual clutter, empty shelves, decorative library, bold colors, dramatic lighting, cold atmosphere, unrealistic rendering, cgi, 3d render, cartoon, low quality, blurry, distorted architecture, modified windows, modified doors, removed radiators, removed moldings, fake walls, fake ceiling, incorrect room proportions`,
  
  living_room: `bedroom, TV wall, gaming room, decorative library, empty shelves, oversized sofa`,
  dining_room: `living room sofa, TV area, office furniture, decorative shelves`,
  kitchen: `living room, dining area, bedroom furniture, decorative styling`,
  adult_bedroom: `living room, TV room, gaming setup, office furniture, decorative shelves`,
  master_suite: `luxury hotel suite, living room, decorative shelves, oversized furniture`,
  teen_bedroom: `gaming room, LED lights, living room, luxury bedroom`,
  child_bedroom: `gaming room, adult bedroom, luxury interior, living room`,
  baby_bedroom: `adult bedroom, living room, luxury nursery, gaming room`,
  home_office: `gaming room, bedroom, living room, decorative furniture`,
  entrance: `living room, oversized furniture, decorative library, large storage`,
  bathroom: `luxury spa, bedroom furniture, living room, oversized bathtub`,
  laundry_room: `bedroom furniture, living room, luxury laundry`,
  terrace_small: `large terrace, luxury resort, oversized furniture`,
  terrace_large: `luxury villa, pool redesign, oversized lounge furniture`,
};

module.exports = negativePrompts;