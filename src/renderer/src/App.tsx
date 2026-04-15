import Icon from "./components/miscellaneous/Icon";

export default function App(): React.JSX.Element {
  return (
    <div className="grid grid-rows-[auto_1fr_auto] h-screen bg-black">
      <div className="grid grid-cols-3 p-3 gap-16 bg-black">
        <div className="flex justify-start items-center">
          <span>
            {/* Traffic lights will go here on Mac */}
          </span>
        </div>
        <div className="w-lg h-12 relative flex justify-center place-self-center">
          <input
            className="size-full rounded-full bg-white/10 pl-6 pr-12"
            placeholder="Paste a video link"
          />
          <button
            className="absolute right-1 flex justify-center items-center size-12 rounded-full cursor-pointer text-white"
            type="reset"
          >
            <Icon name="close" size={24} className="opacity-50" />
          </button>
        </div>
        <div className="flex justify-end items-center">
          <span>
            {/* Window buttons will go here on Windows */}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 h-full px-3 gap-3">
        <div className="flex bg-dark rounded-lg">
          {/* Content goes here */}
        </div>
      </div>
      <div className="grid grid-cols-3 p-3 gap-16 bg-black">

        <div className="flex justify-start items-center gap-3 min-w-0">
          <div className="h-16 bg-white/10 aspect-video rounded-sm" />
          <div className="flex flex-col items-start min-w-0">
            <span className="block max-w-full truncate text-white font-bold">
              Video title is this, it could be long
            </span>
            <span className="block max-w-full truncate text-sm text-white/50">
              Channel name
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-center items-center gap-4">
          <div className="flex gap-4">
            <div className="flex">
              <button className="flex justify-center items-center size-16 rounded-full cursor-pointer text-white">
                <Icon name="list" size={24} className="opacity-50" />
              </button>
              <button className="flex justify-center items-center size-16 rounded-full cursor-pointer text-white">
                <Icon name="history" size={24} className="opacity-50" />
              </button>
            </div>
            <button className="flex justify-center items-center size-16 rounded-full cursor-pointer text-black bg-white">
              <Icon name="download" size={32} />
            </button>
            <div className="flex">
              <button className="flex justify-center items-center size-16 rounded-full cursor-pointer text-white">
                <Icon name="adjustments" size={24} className="opacity-50" />
              </button>
              <button className="flex justify-center items-center size-16 rounded-full cursor-pointer text-white">
                <Icon name="settings" size={24} className="opacity-50" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-white">Downloading 0%</span>
            <span className="text-white/50 text-sm">4.2GB of 8.1 GB</span>
          </div>
          <Icon name="spinner" size={24} className="animate-spin opacity-50" />
        </div>
      </div>

      <div className="w-full p-3 pt-0">
        <div className="w-full h-2 bg-white/10 rounded-full" />
      </div>
    </div>
  )
}