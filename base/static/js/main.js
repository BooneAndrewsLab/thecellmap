(function() {
    var settings = {
            zoom: localStorage.getItem("zoom") || true,
            label: localStorage.getItem("label") || true,
            isPrivate: localStorage.getItem("isPrivate") || false,
            remove: localStorage.getItem("remove") || false,
            fileType: localStorage.getItem("fileType") || "xls",
            openSearchbar: localStorage.getItem("openSearchbar") || false,
            showBgSvg: localStorage.getItem("showBgSve") || true,
            showLegendSvg: localStorage.getItem("showLegendSvg") || true,
            scroll: localStorage.getItem("scroll") || true,
            advanceUi: localStorage.getItem("advanceUi") || false,
    };
    
    updateSettings(settings)
    
    $(".file-type-select").select2({
        minimumResultsForSearch: -1
    });
    
    $("#tools-settings").click(function() {
        $("#settings-modal").modal('show');
        $("#fileType").val(settings["fileType"])
    });
    
    $("#settings-modal").find(".modal-confirm").click(function(e) {
        $(".setting-checkbox").each(function(i, obj) {
            var id = $(this).attr("id");
            localStorage.setItem(id, this.checked);
            settings[id] = this.checked;
        });
        
        localStorage.setItem("fileType", $("#fileType").val())
        settings["fileType"] = $("#fileType").val();
        $("#id_fileType").val(settings["fileType"])
        $("#id_remove").val(settings["remove"])
        
        $("#settings-modal").modal("hide");
        e.preventDefault();
    });
    
    function updateSettings(settings) {
        for (key in settings) {
            if (key == "fileType") {
                $("#fileType").val(settings["fileType"]).change();
            } else {
                settings[key] = settings[key].toString() == "true";
                $("#" + key).prop("checked", settings[key]);
            }
        }
    }
    
    $(document).ready(function() {
    })
    
    window.updateSettings = updateSettings
    if (!window.settings) {
        window.settings = settings;
    }
})();

