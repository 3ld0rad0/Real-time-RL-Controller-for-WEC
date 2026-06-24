import streamlit as st

st.markdown("""
<style>
/* Make entire container clickable by stretching the button */
div[data-testid="stVerticalBlockBorderWrapper"] {
    position: relative;
    transition: all 0.3s ease;
}
div[data-testid="stVerticalBlockBorderWrapper"]:hover {
    border-color: #ff4b4b;
    box-shadow: 0 0 10px rgba(255, 75, 75, 0.2);
    transform: translateY(-2px);
}
div[data-testid="stVerticalBlockBorderWrapper"] button {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    z-index: 99;
    cursor: pointer;
}
</style>
""", unsafe_allow_html=True)

c1, c2 = st.columns(2)
with c1:
    with st.container(border=True, height=280):
        st.subheader("🏋️ Train Model")
        st.write("Configure and launch a new training session.")
        st.markdown("**Click anywhere to open!**")
        if st.button("invisible_btn"):
            st.write("Clicked!")
