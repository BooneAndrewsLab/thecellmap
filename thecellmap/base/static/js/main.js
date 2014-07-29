(function() {
    var settings = {
            zoom: localStorage.getItem("zoom") || false,
            label: localStorage.getItem("label") || false,
            isPrivate: localStorage.getItem("isPrivate") || false,
            remove: localStorage.getItem("remove") || false,
            fileType: localStorage.getItem("fileType") || "xls",
            showDemo: localStorage.getItem("showDemo") || true
    };
    
    var bool = {
            zoom: true,
            label: true,
            isPrivate: true,
            remove: true,
            showDemo: true,
            fileType: false
    }
    
    for (key in settings) {
        if (bool[key]) {
            settings[key] = settings[key].toString() == "true";
            $("#" + key).prop("checked", settings[key]);
        } else if (key == "fileType") {
            $("#fileType").val(settings["fileType"]).change();
        }
    }
    
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
    
    $(document).ready(function() {
    })
    
    if (!window.settings) {
        window.settings = settings;
    }
})();

