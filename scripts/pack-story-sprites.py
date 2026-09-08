"""Pack the selected Craftpix runtime frames. Usage: python3 scripts/pack-story-sprites.py ARCHIVE_DIR
Requires Pillow; input ZIPs: swamp.zip, monsters.zip, effects.zip. See docs/panda-story-mode.md.
"""
from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
import hashlib, json, re, sys
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
out = root / 'public/assets/story'
out.mkdir(parents=True, exist_ok=True)
# One distinct creature for each of the first seven worlds; the last keeps Panda.
creatures = [
    ('turtle', 'swamp', '2 Battle turtle/Battle_turtle', 106),
    ('serpent', 'monsters', 'PNG/medusa', 120),
    ('spirit', 'monsters', 'PNG/jinn_animation', 126),
    ('dragon', 'monsters', 'PNG/dragon', 110),
    ('lizard', 'monsters', 'PNG/lizard', 100),
    ('centipede', 'swamp', '1 Centipede/Centipede', 115),
    ('warrior', 'monsters', 'PNG/demon', 134),
]

def image(z, name):
    return Image.open(BytesIO(z.read(name))).convert('RGBA')

def save_atlas(atlas, name):
    data = BytesIO(); atlas.save(data, format='WEBP', lossless=True, method=6)
    content = data.getvalue(); filename = name + '-' + hashlib.sha256(content).hexdigest()[:10] + '.webp'
    (out / filename).write_bytes(content)
    return '/assets/story/' + filename

bosses = []
for name, pack, path, height in creatures:
    clips = {}
    with ZipFile(source / (pack + '.zip')) as z:
        if pack == 'swamp':
            for action in ['idle', 'sneer', 'walk', 'attack1', 'attack2', 'attack3', 'attack4', 'hurt', 'death']:
                sheet = image(z, path + '_' + action + '.png'); size = sheet.height
                clips[{'sneer':'windup','attack1':'attack'}.get(action, action)] = [sheet.crop((x,0,x+size,size)) for x in range(0,sheet.width,size)]
        else:
            for action in ['Idle', 'Walk', 'Flight', 'Attack', 'Hurt', 'Death']:
                files = [n for n in z.namelist() if re.fullmatch(re.escape(path + '/' + action) + r'\d+\.png', n)]
                files.sort(key=lambda n:int(re.search(r'(\d+)\.png$',n)[1]))
                if files: clips['walk' if action == 'Flight' else action.lower()] = [image(z,n) for n in files]
            clips['windup'] = clips['idle']
        boxes = [im.getbbox() for frames in clips.values() for im in frames if im.getbbox()]
        bounds = (min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
        idle = clips['idle'][0].getbbox(); w,h = bounds[2]-bounds[0],bounds[3]-bounds[1]
        atlas = Image.new('RGBA',(w*max(map(len,clips.values())),h*len(clips)))
        rows = {}
        for row,(action,frames) in enumerate(clips.items()):
            rows[action] = {'row':row,'frames':len(frames)}
            for col,im in enumerate(frames):atlas.paste(im.crop(bounds),(col*w,row*h))
        bosses.append({'name':name,'src':save_atlas(atlas,'boss-'+name),'w':w,'h':h,'anchorX':(idle[0]+idle[2])/2-bounds[0],'anchorY':idle[3]-bounds[1],'scale':height/(idle[3]-idle[1]),'height':height,'clips':rows})
        print(name,atlas.size,flush=True)

# Shared effects sheet: only the five effects used by the game are included.
fx = {}; atlas = Image.new('RGBA',(960,480))
with ZipFile(source / 'effects.zip') as z:
    for row,(name,folder) in enumerate([('impact','Explosion_1'),('dust','Explosion_3'),('magic','Explosion_6'),('poison','Explosion_9'),('burst','Explosion_5')]):
        files = [n for n in z.namelist() if re.fullmatch('PNG/'+folder+r'/Explosion_\d+\.png',n)]
        files.sort(key=lambda n:int(re.search(r'(\d+)\.png$',n)[1]))
        frames = [image(z,n) for n in files]
        boxes = [im.getbbox() for im in frames if im.getbbox()]
        bounds=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
        for col,im in enumerate(frames):
            im=im.crop(bounds);im.thumbnail((92,92),Image.Resampling.LANCZOS)
            atlas.paste(im,(col*96+(96-im.width)//2,row*96+(96-im.height)//2))
        fx[name]={'row':row,'frames':len(frames)}
manifest={'bosses':bosses,'effects':{'src':save_atlas(atlas,'combat-effects'),'w':96,'h':96,'clips':fx}}
(root/'src/game/adventure/sprite-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
