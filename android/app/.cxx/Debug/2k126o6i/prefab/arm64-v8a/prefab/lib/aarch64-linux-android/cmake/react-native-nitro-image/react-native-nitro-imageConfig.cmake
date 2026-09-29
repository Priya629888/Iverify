if(NOT TARGET react-native-nitro-image::NitroImage)
add_library(react-native-nitro-image::NitroImage SHARED IMPORTED)
set_target_properties(react-native-nitro-image::NitroImage PROPERTIES
    IMPORTED_LOCATION "C:/reactnative Project/everfiypersonal/mobile/node_modules/react-native-nitro-image/android/build/intermediates/cxx/Debug/31x6e67m/obj/arm64-v8a/libNitroImage.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/reactnative Project/everfiypersonal/mobile/node_modules/react-native-nitro-image/android/build/headers/nitroimage"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

