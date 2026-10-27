package com.tvphotogallery

import android.view.WindowManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Keeps the TV from starting its screensaver or sleeping while a slideshow
// plays: nobody presses a key, and the screensaver would pause it
class KeepAwakeModule(context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  override fun getName() = NAME

  @ReactMethod
  fun setActive(active: Boolean) {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
      val flag = WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
      if (active) activity.window.addFlags(flag) else activity.window.clearFlags(flag)
    }
  }

  companion object {
    const val NAME = "KeepAwake"
  }
}
