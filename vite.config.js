const isCodeSandbox = 'SANDBOX_URL' in process.env || 'CODESANDBOX_HOST' in process.env
import { resolve } from 'path'

export default {
    root: 'src/',
    publicDir: '../static/',
    base: './',
    server:
    {
        host: true,
        open: !isCodeSandbox // Open if it's not a CodeSandbox
    },
    build:
    {
        outDir: '../dist',
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'src/index.html'),
                pointcloud: resolve(__dirname, 'src/pointcloud.html'),
                imagePointcloud: resolve(__dirname, 'src/imagePointcloud.html'),
                carouselPointcloud: resolve(__dirname, 'src/carouselPointcloud.html'),
                home: resolve(__dirname, 'src/home.html')
            }
        }
    }
}