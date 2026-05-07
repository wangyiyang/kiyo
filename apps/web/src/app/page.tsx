import { Button } from '@kiyo/ui'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold">Kiyo</h1>
        <p className="mt-4 text-lg">AI音乐创作平台</p>
        <div className="mt-8 flex gap-4">
          <Button>默认按钮</Button>
          <Button variant="secondary">次要按钮</Button>
          <Button variant="outline">边框按钮</Button>
        </div>
      </div>
    </main>
  )
}
