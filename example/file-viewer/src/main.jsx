import 'cadbea/ui/style.css'
import { mountCadbeaApp } from 'cadbea/ui'

mountCadbeaApp(document.getElementById('root'), {
  status: 'Drop a .glb, .gltf, or .stl file to review it — no project code required.',
})
